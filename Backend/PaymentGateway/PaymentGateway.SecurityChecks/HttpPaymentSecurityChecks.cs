using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using PaymentGateway.API.Controllers;
using PaymentGateway.API.Middleware;
using PaymentGateway.API.Security;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class HttpPaymentSecurityChecks
{
    private const string SigningKey = "http-security-check-only-signing-key-64-characters-not-a-real-secret";
    private const string WebhookKey = "http-security-webhook-only-not-a-real-secret";

    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var other = new Customer { Email = "http-other@example.invalid" };
        var physical = new Product { ProductName = "HTTP physical", Type = "PHYSICAL", UnitPrice = 100, Stock = 3 };
        var digital = new Product { ProductName = "HTTP digital", Type = "DIGITAL", UnitPrice = 100, DigitalFileKey = "private/http-test.pdf" };
        db.AddRange(other, physical, digital); await db.SaveChangesAsync();

        var payments = new TestPayments(); var storage = new TestStorage();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ApplicationName = typeof(CheckoutController).Assembly.GetName().Name,
            EnvironmentName = "Production", ContentRootPath = AppContext.BaseDirectory
        });
        builder.Logging.ClearProviders();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:Issuer"] = "http-check-issuer", ["JwtSettings:Audience"] = "http-check-audience",
            ["JwtSettings:SecretKey"] = SigningKey, ["MercadoPago:WebhookSecret"] = WebhookKey,
            ["Store:WebhookUrl"] = "https://example.com/api/checkout/webhook"
        });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddControllers().AddApplicationPart(typeof(CheckoutController).Assembly);
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(jwt =>
            jwt.TokenValidationParameters = JwtAuthentication.ValidationParameters(builder.Configuration));
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton(options); builder.Services.AddScoped<PaymentDbContext>();
        builder.Services.AddScoped<IOrderRepository, OrderRepository>(); builder.Services.AddScoped<IOrderService, OrderService>();
        builder.Services.AddScoped<IPaymentReconciliationService, PaymentReconciliationService>();
        builder.Services.AddSingleton<IPaymentService>(payments); builder.Services.AddSingleton<IAssetStorage>(storage);
        await using var app = builder.Build();
        app.UseMiddleware<ExceptionMiddleware>(); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
        try
        {
            string Token(int id, string role = "CUSTOMER", string? key = null, string? issuer = null,
                string? audience = null, bool expired = false, bool includeCustomer = true, bool unsigned = false)
            {
                var claims = new List<Claim> { new(ClaimTypes.Role, role) };
                if (includeCustomer) claims.Add(new("idCustomer", id.ToString()));
                return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(issuer ?? "http-check-issuer",
                    audience ?? "http-check-audience", claims, DateTime.UtcNow.AddHours(-1),
                    expired ? DateTime.UtcNow.AddMinutes(-10) : DateTime.UtcNow.AddHours(1),
                    unsigned ? null : new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key ?? SigningKey)), SecurityAlgorithms.HmacSha256)));
            }
            var owner = Token(customerId); var stranger = Token(other.IdCustomer); var admin = Token(customerId, "ADMIN");
            async Task<(int Code, string Body)> Send(HttpMethod method, string path, string? token = null, string? json = null,
                bool signed = false, string? webhookSecret = null)
            {
                using var request = new HttpRequestMessage(method, path);
                if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                if (json is not null) request.Content = new StringContent(json, Encoding.UTF8, "application/json");
                if (signed)
                {
                    const string requestId = "independent-http-signature-check";
                    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
                    var hash = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(webhookSecret ?? WebhookKey),
                        Encoding.UTF8.GetBytes($"id:456;request-id:{requestId};ts:{timestamp};")));
                    request.Headers.Add("x-request-id", requestId); request.Headers.Add("x-signature", $"ts={timestamp},v1={hash}");
                }
                using var response = await client.SendAsync(request);
                var body = await response.Content.ReadAsStringAsync();
                if (signed && (int)response.StatusCode == 200)
                    await new PaymentNotificationWorker(app.Services.GetRequiredService<IServiceScopeFactory>(),
                        NullLogger<PaymentNotificationWorker>.Instance, new OrderWorkSignal()).ProcessPendingAsync();
                return ((int)response.StatusCode, body);
            }
            static JsonElement Json(string value) => JsonSerializer.Deserialize<JsonElement>(value);
            string Cart(int id) => JsonSerializer.Serialize(new { items = new[] { new { idProduct = id, quantity = 1 } } });
            const string webhook = """{"action":"payment.updated","data":{"id":"456"}}""";
            const string webhookUrl = "/api/checkout/webhook?data.id=456";

            foreach (var path in new[] { "/api/order/1", "/api/orders/my-purchases", "/api/orders/items/1/download" })
                check((await Send(HttpMethod.Get, path)).Code == 401, "HTTP anonymous request cannot access " + path);
            check((await Send(HttpMethod.Post, "/api/checkout/create-order", json: Cart(physical.IdProduct))).Code == 401,
                "HTTP checkout authentication runs before order creation");
            check((await Send(HttpMethod.Post, "/api/admin/orders/1/cancel")).Code == 401 &&
                (await Send(HttpMethod.Post, "/api/admin/orders/1/cancel", owner)).Code == 403,
                "HTTP admin cancellation refuses anonymous users and customers through authorization middleware");
            check((await Send(HttpMethod.Patch, "/api/admin/products/stock", owner, """{"items":[]}""")).Code == 403,
                "HTTP customer cannot change inventory through admin stock endpoint");
            check((await Send(HttpMethod.Post, "/api/admin/orders/2147483647/cancel", admin)).Code == 404,
                "HTTP administrator passes the role guard and reaches the protected action");
            foreach (var invalid in new[] { "not-a-jwt", Token(customerId, key: SigningKey + "wrong"), Token(customerId, expired: true),
                Token(customerId, issuer: "attacker"), Token(customerId, audience: "another-store"), Token(customerId, unsigned: true) })
                check((await Send(HttpMethod.Get, "/api/orders/my-purchases", invalid)).Code == 401,
                    "HTTP JWT rejects malformed/forged/expired/wrong-issuer/wrong-audience/unsigned credentials");
            check((await Send(HttpMethod.Post, "/api/admin/orders/1/cancel", Token(customerId, "ADMIN", key: SigningKey + "wrong"))).Code == 401,
                "HTTP forged administrator claim cannot bypass JWT signature validation");
            check((await Send(HttpMethod.Get, "/api/orders/my-purchases", Token(customerId, includeCustomer: false))).Code == 401,
                "HTTP valid JWT without customer identity cannot access purchases");

            foreach (var malformed in new[] { "{}", "{", """{"items":null}""", """{"items":[null]}""",
                """{"items":[{"idProduct":1,"quantity":-1}]}""", """{"items":[{"idProduct":1,"quantity":1001}]}""" })
                check((await Send(HttpMethod.Post, "/api/checkout/create-order", owner, malformed)).Code == 400,
                    "HTTP model validation rejects malformed or invalid cart before payment preference");
            check(payments.Preferences == 0, "HTTP unauthorized and malformed checkouts never reach payment provider");

            var forgedCart = JsonSerializer.Serialize(new { idCustomer = other.IdCustomer, totalAmount = 1, status = "APPROVED",
                items = new[] { new { idProduct = physical.IdProduct, quantity = 1, finalPrice = 1 } } });
            var created = await Send(HttpMethod.Post, "/api/checkout/create-order", owner, forgedCart);
            check(created.Code == 200, "HTTP authenticated checkout succeeds with a simulated payment provider");
            var orderId = Json(created.Body).GetProperty("orderId").GetInt32();
            var stored = await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == orderId);
            check(stored.IdCustomer == customerId && stored.TotalAmount == 100 && stored.Status == "PENDING_PAYMENT" &&
                await db.Products.AsNoTracking().Where(p => p.IdProduct == physical.IdProduct).Select(p => p.Stock).SingleAsync() == 2,
                "HTTP checkout ignores forged customer/status/prices and reserves stock using server values");
            var lookups = payments.Lookups;
            check((await Send(HttpMethod.Get, $"/api/order/{orderId}", stranger)).Code == 404 &&
                (await Send(HttpMethod.Post, $"/api/checkout/orders/{orderId}/sync-payment", stranger)).Code == 404 && payments.Lookups == lookups,
                "HTTP other customer cannot read or trigger reconciliation for a known order ID");
            var manipulated = await Send(HttpMethod.Get, $"/api/order/{orderId}?status=approved&payment_id=456", owner);
            check(Json(manipulated.Body).GetProperty("status").GetString() == "PENDING_PAYMENT",
                "HTTP browser return parameters cannot approve an order");

            payments.Result = new(456, "pending", orderId.ToString(), 100, "ARS");
            check((await Send(HttpMethod.Post, webhookUrl, json: webhook)).Code == 401 &&
                (await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true, webhookSecret: "wrong-secret")).Code == 401 && payments.Lookups == lookups,
                "HTTP unsigned or incorrectly signed webhooks are rejected before provider lookup");
            check((await Send(HttpMethod.Post, "/api/checkout/webhook?data.id=457", json: webhook, signed: true)).Code == 401 &&
                (await Send(HttpMethod.Post, "/api/checkout/webhook?data.id=456&data.id=456", json: webhook, signed: true)).Code == 401 &&
                (await Send(HttpMethod.Post, webhookUrl, json: """{"action":"payment.updated","data":{"id":"457"}}""", signed: true)).Code == 400 &&
                payments.Lookups == lookups,
                "HTTP signed webhook cannot change its query/body payment ID or use ambiguous query parameters");
            check((await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true)).Code == 200 &&
                (await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == orderId)).Status == "PAYMENT_PROCESSING",
                "HTTP signed pending payment never becomes approved");
            payments.Result = payments.Result with { Status = "approved", Amount = 1 };
            check((await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true)).Code == 200 &&
                (await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == orderId)).Status == "PAYMENT_PROCESSING",
                "HTTP valid signature cannot bypass exact amount verification");
            payments.Result = payments.Result with { Amount = 100, Currency = "USD" };
            check((await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true)).Code == 200,
                "HTTP approved payment with a different currency is refused");
            payments.Result = payments.Result with { Currency = "ARS" };
            check((await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true)).Code == 200 &&
                (await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true)).Code == 200 &&
                await db.Products.AsNoTracking().Where(p => p.IdProduct == physical.IdProduct).Select(p => p.Stock).SingleAsync() == 2 &&
                (await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == orderId)).ConfirmationEmailPending,
                "HTTP approved webhook retries are idempotent for reserved stock and durably queue confirmation");

            var digitalCreated = await Send(HttpMethod.Post, "/api/checkout/create-order", owner, Cart(digital.IdProduct));
            var digitalOrderId = Json(digitalCreated.Body).GetProperty("orderId").GetInt32();
            var itemId = await db.OrderItems.Where(i => i.IdOrder == digitalOrderId).Select(i => i.IdOrderItem).SingleAsync();
            check((await Send(HttpMethod.Get, $"/api/orders/items/{itemId}/download?status=approved", owner)).Code == 404 && storage.Downloads == 0,
                "HTTP unpaid digital purchase cannot download even with a forged query status");
            payments.Result = payments.Result with { ExternalReference = digitalOrderId.ToString() };
            await Send(HttpMethod.Post, webhookUrl, json: webhook, signed: true);
            check((await Send(HttpMethod.Get, $"/api/orders/items/{itemId}/download", stranger)).Code == 404 &&
                (await Send(HttpMethod.Get, $"/api/orders/items/{itemId}/download?file=-1", owner)).Code == 404 &&
                (await Send(HttpMethod.Get, $"/api/orders/items/{itemId}/download?file=99", owner)).Code == 404 && storage.Downloads == 0,
                "HTTP paid digital downloads enforce owner and valid file index before creating a signed URL");
            check((await Send(HttpMethod.Get, $"/api/orders/items/{itemId}/download", owner)).Code == 200 && storage.Downloads == 1,
                "HTTP only the approved digital purchase owner obtains a download URL");

            var count = await db.Orders.CountAsync();
            payments.FailPreference = true;
            var failed = await Send(HttpMethod.Post, "/api/checkout/create-order", owner, Cart(physical.IdProduct));
            check(failed.Code == 500 && await db.Orders.CountAsync() == count &&
                await db.Products.AsNoTracking().Where(p => p.IdProduct == physical.IdProduct).Select(p => p.Stock).SingleAsync() == 2,
                "HTTP payment preference failure rolls back both order and stock reservation");
            check(!failed.Body.Contains(TestPayments.InternalDetail) && !failed.Body.Contains("Detailed", StringComparison.OrdinalIgnoreCase),
                "HTTP unexpected provider exceptions never expose internal details in the public 500 response");
        }
        finally { await app.StopAsync(); }
    }

    private sealed class TestPayments : IPaymentService
    {
        public const string InternalDetail = "sensitive-provider-diagnostic-must-stay-in-server-logs";
        public int Preferences { get; private set; }
        public int Lookups { get; private set; }
        public bool FailPreference { get; set; }
        public VerifiedPayment Result { get; set; } = new(456, "pending", null, 100, "ARS");
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order)
        {
            Preferences++;
            if (FailPreference) throw new HttpRequestException(InternalDetail);
            return Task.FromResult(new PaymentPreferenceResponse { PreferenceId = "http-test-" + order.IdOrder, InitPoint = "https://example.com/pay" });
        }
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId) { Lookups++; return Task.FromResult(Result); }
        public Task<long?> FindPaymentIdForOrderAsync(Order order) => Task.FromResult<long?>(456);
    }
    private sealed class TestStorage : IAssetStorage
    {
        public int Downloads { get; private set; }
        public string CreateDownloadUrl(string key) { Downloads++; return "https://example.com/private-test-download"; }
        public string CreatePreviewUrl(string key) => throw new NotSupportedException();
        public Task<string> UploadImageAsync(Stream stream, string name, CancellationToken ct) => throw new NotSupportedException();
        public Task<string> UploadImageFromUrlAsync(string url, CancellationToken ct) => throw new NotSupportedException();
        public Task<string> UploadDigitalFileAsync(Stream stream, string name, string type, CancellationToken ct) => throw new NotSupportedException();
    }
}
