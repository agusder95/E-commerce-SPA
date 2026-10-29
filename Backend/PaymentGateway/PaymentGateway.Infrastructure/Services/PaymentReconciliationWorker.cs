using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentReconciliationWorker(IServiceScopeFactory scopes, ILogger<PaymentReconciliationWorker> logger,
    IOptions<PaymentTrackingOptions>? tracking = null, OrderWorkSignal? signal = null)
    : ScheduledOrderWorker(signal ?? new OrderWorkSignal(), logger, TimeSpan.FromSeconds(tracking?.Value.WorkerIntervalSeconds ?? 15))
{
    private readonly PaymentTrackingOptions _tracking = tracking?.Value ?? new PaymentTrackingOptions();
    protected override async Task<DateTime?> RunAndGetNextAsync(CancellationToken cancellationToken)
    {
        await ReconcilePendingAsync(cancellationToken);
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        return await db.Orders.Where(o => o.NextPaymentCheckAt != null && o.MercadoPagoPreferenceId != null && o.MercadoPagoPreferenceId != "" &&
            (o.Status == "Pending" || o.Status == "PENDING_PAYMENT" || o.Status == "PAYMENT_PROCESSING" || o.Status == "REJECTED" || o.Status == "CANCELLED"))
            .MinAsync(o => o.NextPaymentCheckAt, cancellationToken);
    }

    public async Task ReconcilePendingAsync(CancellationToken cancellationToken = default)
    {
        using var queryScope = scopes.CreateScope();
        var queryDb = queryScope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        var now = DateTime.UtcNow;
        // Stop expired recovery queues permanently; authenticated webhooks still work afterwards.
        var expired = await queryDb.Orders.Where(o => o.NextPaymentCheckAt != null && o.Status != "Pending" && o.Status != "PENDING_PAYMENT" &&
            (o.ExpiresAt ?? o.DatePurchase.AddMinutes(_tracking.ReservationMinutes)).AddHours(_tracking.RecoveryHours) <= now)
            .ExecuteUpdateAsync(update => update.SetProperty(o => o.NextPaymentCheckAt, (DateTime?)null), cancellationToken);
        if (expired > 0) logger.LogInformation("Finalizó el seguimiento automático de {Count} órdenes; los pagos en proceso requieren revisión si no llega un webhook.", expired);
        var ids = await queryDb.Orders.AsNoTracking().Where(o => o.NextPaymentCheckAt != null && o.NextPaymentCheckAt <= now &&
            o.MercadoPagoPreferenceId != null && o.MercadoPagoPreferenceId != "" &&
            (o.Status == "Pending" || o.Status == "PENDING_PAYMENT" || o.Status == "PAYMENT_PROCESSING" ||
             o.Status == "REJECTED" || o.Status == "CANCELLED"))
            .OrderBy(o => o.NextPaymentCheckAt).ThenBy(o => o.IdOrder).Take(_tracking.BatchSize)
            .Select(o => o.IdOrder).ToListAsync(cancellationToken);
        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
                var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.IdOrder == id, cancellationToken);
                if (order is null || order.Status is "APPROVED" or "PAID_REQUIRES_REVIEW") continue;
                using var priority = order.FastRecoveryRemaining > 0 ? PaymentRequestPriority.Urgent() : null;
                var result = await scope.ServiceProvider.GetRequiredService<IPaymentReconciliationService>().ReconcileAsync(null, order);
                if (result != PaymentReconciliationResult.Success)
                    logger.LogWarning("No se pudo conciliar la orden {OrderId}: {Result}; se reintentará.", id, result);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception) { logger.LogError(exception, "No se pudo conciliar la orden {OrderId}; se reintentará.", id); }
        }
    }
}
