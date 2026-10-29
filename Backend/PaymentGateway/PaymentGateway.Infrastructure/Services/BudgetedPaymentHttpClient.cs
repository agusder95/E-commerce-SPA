using System.Diagnostics.Metrics;
using System.Globalization;
using MercadoPago.Http;

namespace PaymentGateway.Infrastructure.Services;

public sealed class BudgetedPaymentHttpClient(IHttpClient inner, PaymentProviderBudget budget) : IHttpClient
{
    private static readonly Meter Meter = new("PaymentGateway.Payments.Transport");
    private static readonly Counter<long> Requests = Meter.CreateCounter<long>("payment.provider.http.requests");
    private static readonly Counter<long> Deferred = Meter.CreateCounter<long>("payment.provider.deferred");
    public async Task<MercadoPagoResponse> SendAsync(MercadoPagoRequest request, IRetryStrategy retryStrategy, CancellationToken cancellationToken = default)
    {
        var urgent = PaymentRequestPriority.IsUrgent || request.Url.ToString().Contains("/checkout/preferences");
        try { await budget.AcquireAsync(urgent); }
        catch (PaymentProviderDeferredException) { Deferred.Add(1); throw; }
        Requests.Add(1);
        // Workers own retries. Hidden SDK retries must not bypass the distributed request budget.
        var response = await inner.SendAsync(request, new DefaultRetryStrategy(0), cancellationToken);
        if (response.StatusCode == 429)
        {
            var delay = TimeSpan.FromSeconds(30);
            var header = response.Headers?.FirstOrDefault(h => h.Key.Equals("Retry-After", StringComparison.OrdinalIgnoreCase)).Value;
            if (double.TryParse(header, NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds) && seconds >= 0 && double.IsFinite(seconds))
                delay = TimeSpan.FromSeconds(Math.Clamp(seconds, 1, 86400));
            else if (DateTimeOffset.TryParse(header, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date))
                delay = TimeSpan.FromSeconds(Math.Clamp((date.UtcDateTime - DateTime.UtcNow).TotalSeconds, 1, 86400));
            await budget.BlockAsync(delay);
            throw new PaymentProviderDeferredException(DateTime.UtcNow.Add(delay));
        }
        return response;
    }
}
