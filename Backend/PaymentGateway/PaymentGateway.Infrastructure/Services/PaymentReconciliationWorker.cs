using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentReconciliationWorker(IServiceScopeFactory scopes, ILogger<PaymentReconciliationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do
        {
            try { await ReconcilePendingAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception) { logger.LogError(exception, "No se pudo consultar la cola de pagos pendientes; se reintentará."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task ReconcilePendingAsync(CancellationToken cancellationToken = default)
    {
        using var queryScope = scopes.CreateScope();
        var queryDb = queryScope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        // Incluye reservas liberadas: un pago tardío puede requerir recuperar stock o revisión.
        // shortcut: recorre todas las órdenes sin resolver; usar una cola con backoff si crece el volumen.
        var ids = await queryDb.Orders.AsNoTracking().Where(o => o.MercadoPagoPreferenceId != null && o.MercadoPagoPreferenceId != "" &&
            (o.Status == "Pending" || o.Status == "PENDING_PAYMENT" || o.Status == "PAYMENT_PROCESSING" ||
             o.Status == "REJECTED" || o.Status == "CANCELLED"))
            .OrderBy(o => o.IdOrder).Select(o => o.IdOrder).ToListAsync(cancellationToken);
        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
                var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.IdOrder == id, cancellationToken);
                if (order is null || order.Status is "APPROVED" or "PAID_REQUIRES_REVIEW") continue;
                var result = await scope.ServiceProvider.GetRequiredService<IPaymentReconciliationService>().ReconcileAsync(null, order);
                if (result != PaymentReconciliationResult.Success)
                    logger.LogWarning("No se pudo conciliar la orden {OrderId}: {Result}; se reintentará.", id, result);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception) { logger.LogError(exception, "No se pudo conciliar la orden {OrderId}; se reintentará.", id); }
        }
    }
}
