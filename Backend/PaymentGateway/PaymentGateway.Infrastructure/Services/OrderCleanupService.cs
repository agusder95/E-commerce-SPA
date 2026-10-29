using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class OrderCleanupService(IServiceScopeFactory scopes, ILogger<OrderCleanupService> logger,
    IOptions<PaymentTrackingOptions>? tracking = null, OrderWorkSignal? signal = null)
    : ScheduledOrderWorker(signal ?? new OrderWorkSignal(), logger, TimeSpan.FromSeconds(tracking?.Value.CleanupIntervalSeconds ?? 30))
{
    private readonly PaymentTrackingOptions _tracking = tracking?.Value ?? new PaymentTrackingOptions();

    protected override async Task<DateTime?> RunAndGetNextAsync(CancellationToken cancellationToken)
    {
        await CleanupExpiredAsync(cancellationToken);
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        return await db.Orders.Where(o => (o.Status == "Pending" || o.Status == "PENDING_PAYMENT") &&
            (o.MercadoPagoPreferenceId == null || o.MercadoPagoPreferenceId == "" || o.NextPaymentCheckAt != null))
            .Select(o => new { Expires = o.ExpiresAt ?? o.DatePurchase.AddMinutes(_tracking.ReservationMinutes),
                Check = o.NextPaymentCheckAt, HasPreference = o.MercadoPagoPreferenceId != null && o.MercadoPagoPreferenceId != "" })
            .Select(o => o.HasPreference && o.Check > o.Expires ? o.Check : (DateTime?)o.Expires)
            .MinAsync(cancellationToken);
    }

    public async Task CleanupExpiredAsync(CancellationToken cancellationToken = default)
    {
        using var scope = scopes.CreateScope();
        var orders = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
        var stale = await orders.GetStalePendingOrdersAsync(DateTime.UtcNow);
        foreach (var order in stale)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                // Discard tracked entities after each order, including failed transactions.
                using var orderScope = scopes.CreateScope();
                if (string.IsNullOrWhiteSpace(order.MercadoPagoPreferenceId))
                    await orderScope.ServiceProvider.GetRequiredService<IOrderRepository>().CancelOrdersAsync([order]);
                else
                    // The shared service performs a final due check before releasing stock.
                    await orderScope.ServiceProvider.GetRequiredService<IPaymentReconciliationService>().ReconcileAsync(null, order);
            }
            catch (Exception exception) { logger.LogError(exception, "No se pudo revisar la reserva {OrderId}.", order.IdOrder); }
        }
    }
}
