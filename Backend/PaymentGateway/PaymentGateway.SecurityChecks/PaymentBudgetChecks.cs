using System.Security.Cryptography;
using System.Text;
using MercadoPago.Config;
using MercadoPago.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Services;
using StackExchange.Redis;
using Order = PaymentGateway.Domain.Entities.Order;

internal static class PaymentBudgetChecks
{
    public static async Task RunAsync(string connection, Action<bool,string> check)
    {
        using var redis = await ConnectionMultiplexer.ConnectAsync(connection);
        using var peer = await ConnectionMultiplexer.ConnectAsync(connection);
        var keys = new List<RedisKey>(); var originalToken = MercadoPagoConfig.AccessToken;
        (PaymentProviderBudget A, PaymentProviderBudget B, IConfiguration Config) Pair()
        {
            var token = "budget-check-" + Guid.NewGuid().ToString("N");
            keys.Add("payment-provider:{" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token))) + "}:budget");
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["MercadoPago:AccessToken"] = token }).Build();
            var limits = Options.Create(new PaymentTrackingOptions { ProviderRequestsPerMinute = 4, BackgroundRequestsPerMinute = 2, ProviderBurst = 4 });
            return (new(redis, config, limits), new(peer, config, limits), config);
        }
        try
        {
            MercadoPagoConfig.AccessToken = "budget-check-only";
            var pair = Pair(); var transport = new Transport();
            var a = new MercadoPagoService(pair.Config, pair.A, transport); var b = new MercadoPagoService(pair.Config, pair.B, transport);
            var order = new Order { IdOrder = 1, MercadoPagoPreferenceId = "test" };
            await a.FindPaymentIdForOrderAsync(order); await b.FindPaymentIdForOrderAsync(order);
            try { await a.FindPaymentIdForOrderAsync(order); check(false, "Budget: background quota must hold"); }
            catch (PaymentProviderDeferredException) { check(transport.Requests == 2, "Budget: background quota is shared across instances and preserves urgent capacity"); }
            using (PaymentRequestPriority.Urgent())
            {
                await a.VerifyPaymentStatusAsync(1); await b.VerifyPaymentStatusAsync(1);
                try { await b.VerifyPaymentStatusAsync(1); check(false, "Budget: global quota must hold"); }
                catch (PaymentProviderDeferredException) { check(transport.Requests == 4, "Budget: all verification HTTP requests obey the same credential budget"); }
            }
            check(transport.NoHiddenRetries, "Budget: SDK automatic retries are disabled at the actual HTTP boundary");
            var concurrent = Pair();
            var admitted = 0;
            await Task.WhenAll(Enumerable.Range(0, 32).Select(async i => {
                try { await (i % 2 == 0 ? concurrent.A : concurrent.B).AcquireAsync(true); Interlocked.Increment(ref admitted); }
                catch (PaymentProviderDeferredException) { }
            }));
            check(admitted == 4, "Budget: concurrent processes cannot multiply the configured burst or minute quota");
            var limited = Pair(); var throttled = new Transport { Throttled = true };
            var service = new MercadoPagoService(limited.Config, limited.A, throttled);
            try { await service.VerifyPaymentStatusAsync(1); check(false, "Budget: provider 429 must defer"); }
            catch (PaymentProviderDeferredException ex) { check(ex.RetryAt > DateTime.UtcNow.AddSeconds(110), "Budget: provider Retry-After is persisted instead of retried immediately"); }
            try { await limited.B.AcquireAsync(true); check(false, "Budget: provider block must be shared"); }
            catch (PaymentProviderDeferredException ex) { check(ex.RetryAt > DateTime.UtcNow.AddSeconds(110) && throttled.Requests == 1, "Budget: provider throttle pauses every instance, including urgent requests"); }
        }
        finally { await redis.GetDatabase().KeyDeleteAsync(keys.ToArray()); MercadoPagoConfig.AccessToken = originalToken; }
    }
    private sealed class Transport : IHttpClient
    {
        public int Requests; public bool NoHiddenRetries = true; public bool Throttled;
        public Task<MercadoPagoResponse> SendAsync(MercadoPagoRequest request, IRetryStrategy retryStrategy, CancellationToken cancellationToken = default)
        {
            Requests++; NoHiddenRetries &= retryStrategy is DefaultRetryStrategy { MaxNumberRetries: 0 };
            return Task.FromResult(Throttled ? new MercadoPagoResponse(429, new Dictionary<string,string> { ["Retry-After"] = "120" }, "{}")
                : new MercadoPagoResponse(200, new Dictionary<string,string>(), request.Url.ToString().Contains("search") ? "{\"elements\":[],\"total\":0}" :
                    "{\"id\":1,\"status\":\"pending\",\"external_reference\":\"1\",\"transaction_amount\":100,\"currency_id\":\"ARS\"}"));
        }
    }
}
