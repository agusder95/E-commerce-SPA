using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using Order = PaymentGateway.Domain.Entities.Order;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using IServer = Microsoft.AspNetCore.Hosting.Server.IServer;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;
using StackExchange.Redis;

internal static class PinLoginSecurityChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> dbOptions, string connection, Action<bool, string> check)
    {
        using var redis = await ConnectionMultiplexer.ConnectAsync(connection);
        using var peer = await ConnectionMultiplexer.ConnectAsync(connection);
        var prefix = "security-check:pin:" + Guid.NewGuid().ToString("N") + ":";
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "pin-check-only-secret-with-at-least-64-characters-not-a-real-secret",
            ["JwtSettings:Issuer"] = "pin-check", ["JwtSettings:Audience"] = "pin-check",
            ["JwtSettings:ExpirationMinutes"] = "30"
        }).Build();
        var proof = new PinProof(configuration);
        check(AccessCodeEmail.Create("012345", 120).Text.Contains("2 minutos") && AccessCodeEmail.Create("012345", 90).Html.Contains("90 segundos"),
            "PIN email: displayed expiry follows the configured server lifetime");
        var sequence = 0;
        (PinLoginOptions Policy, RedisPinChallengeStore Store, RedisPinChallengeStore Peer) NewCase(Action<PinLoginOptions>? customize = null)
        {
            var policy = new PinLoginOptions { RedisKeyPrefix = prefix + (++sequence) + ":" };
            customize?.Invoke(policy);
            return (policy, new(redis, Options.Create(policy)), new(peer, Options.Create(policy)));
        }
        static string Id(string value) => PinProof.Identifier(value);
        async Task<PinAttemptResult> Issue(RedisPinChallengeStore store, string email = "test@example.invalid", string ip = "client", string nonce = "nonce", string pin = "012345") =>
            await store.TryIssueAsync(Id(email), Id(ip), nonce, proof.Create(email, nonce, pin));
        async Task<PinAttemptResult> Consume(RedisPinChallengeStore store, string email = "test@example.invalid", string ip = "client", string nonce = "nonce", string pin = "012345") =>
            await store.TryConsumeAsync(Id(email), Id(ip), nonce, proof.Create(email, nonce, pin));
        try
        {
            var a = NewCase();
            var results = await Task.WhenAll(Enumerable.Range(0, 16).Select(i => Issue(i % 2 == 0 ? a.Store : a.Peer)));
            check(results.Count(r => r.Status == PinAttemptStatus.Issued) == 1, "PIN Redis: concurrent issuance across connections sends exactly one challenge");
            check(results.Where(r => r.Status == PinAttemptStatus.Throttled).All(r => r.RetryAfterSeconds is > 0 and <= 60), "PIN Redis: resend cooldown has a bounded Retry-After");
            var consumed = await Task.WhenAll(Enumerable.Range(0, 16).Select(i => Consume(i % 2 == 0 ? a.Store : a.Peer)));
            check(consumed.Count(r => r.Status == PinAttemptStatus.Verified) == 1, "PIN Redis: exactly one simultaneous verification consumes the challenge");
            check(await a.Store.GetChallengeIdAsync(Id("test@example.invalid")) is null, "PIN Redis: successful challenge is deleted and cannot be replayed");

            a = NewCase(); await Issue(a.Store);
            for (var i = 1; i <= 5; i++)
            {
                var result = await Consume(i % 2 == 0 ? a.Store : a.Peer, ip: "attacker-" + i, pin: "999999");
                check(result.Status == (i == 5 ? PinAttemptStatus.Throttled : PinAttemptStatus.Invalid), "PIN Redis: failures count across clients and instances, attempt " + i);
            }
            var locked = await Consume(a.Peer);
            check(locked.Status == PinAttemptStatus.Throttled && locked.RetryAfterSeconds is > 890 and <= 900, "PIN Redis: correct code cannot bypass the 15-minute lockout");
            check((await Issue(a.Peer, ip: "other-client")).Status == PinAttemptStatus.Throttled && await a.Store.GetChallengeIdAsync(Id("test@example.invalid")) is null,
                "PIN Redis: lockout blocks resends and destroys the compromised challenge");

            a = NewCase(p => p.MaxRequestsPerIp = 2);
            await Issue(a.Store, "one@example.invalid"); await Issue(a.Peer, "two@example.invalid");
            check((await Issue(a.Store, "three@example.invalid")).Status == PinAttemptStatus.Throttled, "PIN Redis: request quota follows IP across different accounts");
            a = NewCase(p => p.MaxVerificationsPerIp = 2);
            await Consume(a.Store, "one@example.invalid"); await Consume(a.Peer, "two@example.invalid");
            check((await Consume(a.Store, "three@example.invalid")).Status == PinAttemptStatus.Throttled, "PIN Redis: verification quota also counts nonexistent challenges");
            a = NewCase(p => p.MaxVerificationsPerEmail = 2);
            await Consume(a.Store, ip: "one"); await Consume(a.Peer, ip: "two");
            check((await Consume(a.Store, ip: "three")).Status == PinAttemptStatus.Throttled, "PIN Redis: account verification quota cannot be bypassed with rotating IPs");

            a = NewCase(p => p.MaxRequestsPerEmail = 2);
            await Issue(a.Store, ip: "one"); await a.Store.RevokeAsync(Id("test@example.invalid"), "nonce");
            await Issue(a.Peer, ip: "two"); await a.Peer.RevokeAsync(Id("test@example.invalid"), "nonce");
            check((await Issue(a.Store, ip: "three")).Status == PinAttemptStatus.Throttled, "PIN Redis: account request budget survives revocation and rotating IPs");

            a = NewCase(p => p.ResendSeconds = 1);
            await Issue(a.Store);
            await Task.Delay(1150);
            check((await Issue(a.Peer, nonce: "replacement", pin: "654321")).Status == PinAttemptStatus.Issued, "PIN Redis: resend works after the configured cooldown");
            await a.Store.RevokeAsync(Id("test@example.invalid"), "nonce");
            check(await a.Peer.GetChallengeIdAsync(Id("test@example.invalid")) == "replacement", "PIN Redis: delayed mail failure cannot delete a newer challenge");
            check((await Consume(a.Store)).Status == PinAttemptStatus.Invalid, "PIN Redis: an old PIN and nonce cannot consume a replacement");
            check((await Consume(a.Peer, nonce: "replacement", pin: "654321")).Status == PinAttemptStatus.Verified, "PIN Redis: replacement remains usable after stale verification");

            a = NewCase(p => { p.LifetimeSeconds = 1; p.ResendSeconds = 1; p.LockoutSeconds = 1; p.WindowSeconds = 1; });
            await Issue(a.Store);
            await Task.Delay(1150);
            check((await Consume(a.Store)).Status == PinAttemptStatus.Invalid && await a.Store.GetChallengeIdAsync(Id("test@example.invalid")) is null,
                "PIN Redis: lifetime expires on the server independently of the browser");
            await Issue(a.Store);
            for (var i = 0; i < 5; i++) await Consume(a.Store, pin: "999999");
            await Task.Delay(1150);
            check((await Issue(a.Peer)).Status == PinAttemptStatus.Issued, "PIN Redis: lockout and rate windows expire without background cleanup");

            a = NewCase(); await Issue(a.Store);
            var key = a.Policy.RedisKeyPrefix + "{pin-login}:email:" + Id("test@example.invalid") + ":challenge";
            var stored = await redis.GetDatabase().HashGetAllAsync(key);
            check(stored.Any(e => e.Name == "proof" && e.Value.ToString().Length == 64) && stored.All(e => e.Value != "012345"),
                "PIN Redis: stores a keyed proof rather than the six-digit secret");
            check(await redis.GetDatabase().KeyTimeToLiveAsync(key) is { TotalSeconds: > 0 and <= 300 }, "PIN Redis: the challenge always has a finite TTL");
            check(proof.Create("test@example.invalid", "nonce", "012345") != proof.Create("other@example.invalid", "nonce", "012345") &&
                proof.Create("test@example.invalid", "nonce", "012345") != proof.Create("test@example.invalid", "new", "012345"),
                "PIN proof: HMAC binds the code to its normalized account and unique challenge");

            await HttpChecks(dbOptions, configuration, proof, redis, prefix + "http:", check);
        }
        finally
        {
            // Only this run's GUID-scoped keys; never FLUSHDB or production login keys.
            foreach (var endpoint in redis.GetEndPoints())
            {
                var server = redis.GetServer(endpoint);
                if (server.IsReplica) continue;
                await foreach (var key in server.KeysAsync(pattern: prefix + "*")) await redis.GetDatabase().KeyDeleteAsync(key);
            }
        }
    }

    private static async Task HttpChecks(DbContextOptions<PaymentDbContext> dbOptions, IConfiguration config, PinProof proof,
        IConnectionMultiplexer redis, string prefix, Action<bool, string> check)
    {
        var mail = new Mail();
        var policy = new PinLoginOptions { RedisKeyPrefix = prefix, MaxRequestsPerIp = 100, MaxVerificationsPerIp = 100 };
        var store = new FaultStore(new RedisPinChallengeStore(redis, Options.Create(policy)));
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(AuthController).Assembly.GetName().Name,
            ContentRootPath = AppContext.BaseDirectory, EnvironmentName = "Production"
        });
        builder.Logging.ClearProviders(); builder.Configuration.AddConfiguration(config);
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddControllers().AddApplicationPart(typeof(AuthController).Assembly);
        builder.Services.AddSingleton(proof); builder.Services.AddSingleton(Options.Create(policy));
        builder.Services.AddSingleton<IPinChallengeStore>(store); builder.Services.AddSingleton<IEmailService>(mail);
        builder.Services.AddSingleton(dbOptions); builder.Services.AddScoped<PaymentDbContext>();
        builder.Services.AddScoped<ICustomerRepository, CustomerRepository>(); builder.Services.AddScoped<ITokenService, JwtTokenService>();
        await using var app = builder.Build(); app.MapControllers(); await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
        async Task<(int Code, JsonElement Body, int Retry, string? Cache)> Post(string action, object body, string? spoofIp = null)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/" + action) { Content = JsonContent.Create(body) };
            if (spoofIp is not null) request.Headers.Add("X-Forwarded-For", spoofIp);
            using var response = await client.SendAsync(request);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return ((int)response.StatusCode, json, (int)(response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 0), response.Headers.CacheControl?.ToString());
        }
        try
        {
            foreach (var pin in new[] { "12345", "1234567", "１２３４５６", "١٢٣٤٥٦", "abcdef", "" })
                check((await Post("verify-access", new { email = "invalid@example.invalid", pin })).Code == 400, "PIN HTTP: invalid/Unicode code rejected by model validation");
            check((await Post("request-access", new { email = new string('a', 250) + "@example.invalid" })).Code == 400 && mail.Sent.IsEmpty,
                "PIN HTTP: excessive email length rejected before email or Redis work");
            check((await Post("request-access", new { email = " SAME@example.invalid ", previousEmail = "same@example.invalid" })).Code == 400,
                "PIN HTTP: previous-email validation preserves normalization");

            const string email = "pin-http-new@example.invalid";
            var issued = await Post("request-access", new { email = " PIN-HTTP-NEW@example.invalid " });
            check(issued.Code == 200 && issued.Body.GetProperty("expiresInSeconds").GetInt32() == 300 && issued.Body.GetProperty("resendAfterSeconds").GetInt32() == 60,
                "PIN HTTP: normalized request returns server lifetime and resend policy");
            check(mail.Sent.TryGetValue(email, out var code) && code.Length == 6 && code.All(c => c is >= '0' and <= '9'), "PIN HTTP: generated code contains exactly six ASCII digits");
            var resend = await Post("request-access", new { email }, "203.0.113.1");
            check(resend.Code == 429 && resend.Retry is > 0 and <= 60 && mail.Sent.Count == 1, "PIN HTTP: throttled resend does not send another email and includes Retry-After");
            var before = await CustomerCount();
            var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Post("verify-access", new { email, pin = code, role = "ADMIN", idCustomer = 2147483647 })));
            check(responses.Count(r => r.Code == 200) == 1 && responses.Count(r => r.Code == 400) == 7, "PIN HTTP: simultaneous verification issues exactly one JWT");
            check(await CustomerCount() == before + 1, "PIN HTTP: simultaneous verification creates one normalized customer in PostgreSQL");
            var success = responses.Single(r => r.Code == 200);
            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(success.Body.GetProperty("token").GetString());
            check(jwt.Claims.Any(c => (c.Type == "email" || c.Type == ClaimTypes.Email) && c.Value == email) && jwt.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == "Customer"), "PIN HTTP: new account gets DB identity and customer role, no privilege escalation");
            check(success.Cache == "no-store" && issued.Cache == "no-store", "PIN HTTP: authentication responses forbid cache storage");
            check((await Post("verify-access", new { email, pin = code })).Code == 400, "PIN HTTP: replay after login cannot issue another JWT");

            const string adminEmail = "pin-http-existing-admin@example.invalid";
            int adminId;
            await using (var db = new PaymentDbContext(dbOptions))
            {
                var admin = new Customer { Email = adminEmail, Role = "ADMIN" };
                db.Add(admin); await db.SaveChangesAsync(); adminId = admin.IdCustomer;
            }
            before = await CustomerCount();
            await Post("request-access", new { email = adminEmail });
            var adminLogin = await Post("verify-access", new { email = adminEmail, pin = mail.Sent[adminEmail], role = "Customer", idCustomer = 2147483647 });
            check(adminLogin.Code == 200 && await CustomerCount() == before, "PIN HTTP: existing account login reuses its PostgreSQL customer");
            var adminJwt = new JwtSecurityTokenHandler().ReadJwtToken(adminLogin.Body.GetProperty("token").GetString());
            check(adminJwt.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value == "ADMIN") &&
                adminJwt.Claims.Any(c => c.Type == "idCustomer" && c.Value == adminId.ToString()), "PIN HTTP: account role and identity come from the DB despite forged request fields");

            const string lockedEmail = "pin-http-locked@example.invalid";
            await Post("request-access", new { email = lockedEmail });
            var wrong = mail.Sent[lockedEmail] == "999999" ? "000000" : "999999";
            for (var i = 0; i < 5; i++) await Post("verify-access", new { email = lockedEmail.ToUpperInvariant(), pin = wrong }, "203.0.113." + i);
            var locked = await Post("verify-access", new { email = lockedEmail, pin = mail.Sent[lockedEmail] });
            check(locked.Code == 429 && locked.Retry is > 890 and <= 900 && locked.Body.GetProperty("code").GetString() == "PIN_RATE_LIMITED",
                "PIN HTTP: case changes and spoofed forwarding headers cannot bypass lockout");
            check((await Post("request-access", new { email = lockedEmail })).Code == 429, "PIN HTTP: requesting another code cannot reset a locked account");

            mail.Fail = true;
            var failed = await Post("request-access", new { email = "pin-http-smtp@example.invalid" });
            check(failed.Code == 503 && !failed.Body.ToString().Contains("private-smtp-detail") &&
                await store.GetChallengeIdAsync(PinProof.Identifier("pin-http-smtp@example.invalid")) is null, "PIN HTTP: SMTP failure revokes the code without exposing exception details");
            mail.Fail = false;
            check((await Post("request-access", new { email = "pin-http-smtp@example.invalid" })).Code == 200,
                "PIN HTTP: SMTP failure releases resend cooldown for a retry");

            var sent = mail.Sent.Count; var customerCount = await CustomerCount();
            store.Fail = true;
            check((await Post("request-access", new { email = "pin-http-unavailable@example.invalid" })).Code == 503 && mail.Sent.Count == sent,
                "PIN HTTP: Redis error fails closed before sending email");
            check((await Post("verify-access", new { email, pin = code })).Code == 503 && await CustomerCount() == customerCount,
                "PIN HTTP: Redis error cannot bypass verification or access the customer write path");
            store.Fail = false;

            policy.MaxRequestsPerIp = 2;
            // The same real peer already exceeded two requests. Rotating untrusted headers must not reset that budget.
            check((await Post("request-access", new { email = "pin-http-spoof@example.invalid" }, "198.51.100.9")).Code == 429,
                "PIN HTTP: untrusted X-Forwarded-For cannot create a fresh IP rate bucket");
        }
        finally { await app.StopAsync(); }

        async Task<int> CustomerCount()
        {
            await using var db = new PaymentDbContext(dbOptions);
            return await db.Customers.CountAsync();
        }
    }

    private sealed class Mail : IEmailService
    {
        public readonly ConcurrentDictionary<string, string> Sent = new();
        public bool Fail;
        public Task SendPinEmailAsync(string email, string pin)
        {
            if (Fail) throw new InvalidOperationException("private-smtp-detail");
            Sent[email] = pin; return Task.CompletedTask;
        }
        public Task SendPurchaseConfirmationAsync(string email, Order order) => throw new NotSupportedException();
    }
    private sealed class FaultStore(IPinChallengeStore inner) : IPinChallengeStore
    {
        public bool Fail;
        private void Guard() { if (Fail) throw new RedisConnectionException(ConnectionFailureType.UnableToConnect, "private-redis-detail"); }
        public Task<PinAttemptResult> TryIssueAsync(string subject, string client, string nonce, string proof)
        { Guard(); return inner.TryIssueAsync(subject, client, nonce, proof); }
        public Task<string?> GetChallengeIdAsync(string subject) { Guard(); return inner.GetChallengeIdAsync(subject); }
        public Task<PinAttemptResult> TryConsumeAsync(string subject, string client, string? nonce, string proof)
        { Guard(); return inner.TryConsumeAsync(subject, client, nonce, proof); }
        public Task RevokeAsync(string subject, string nonce) { Guard(); return inner.RevokeAsync(subject, nonce); }
    }
}
