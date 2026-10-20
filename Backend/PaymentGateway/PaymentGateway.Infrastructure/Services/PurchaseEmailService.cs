using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

// The paid transition and the pending flag are committed together. SMTP failures
// never roll back a verified payment, and pending messages survive API restarts.
public sealed class PurchaseEmailService(IServiceScopeFactory scopes, ILogger<PurchaseEmailService> logger, OrderWorkSignal? signal = null)
    : ScheduledOrderWorker(signal ?? new OrderWorkSignal(), logger, TimeSpan.FromSeconds(15))
{
    protected override async Task<DateTime?> RunAndGetNextAsync(CancellationToken cancellationToken)
    {
        await SendPendingAsync(cancellationToken);
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        var pending = await db.Orders.AnyAsync(o => o.ConfirmationEmailPending &&
            (o.Status == "APPROVED" || o.Status == "PAID_REQUIRES_REVIEW"), cancellationToken);
        return pending ? DateTime.UtcNow.AddSeconds(15) : null;
    }

    public async Task SendPendingAsync(CancellationToken cancellationToken = default)
    {
        using var queryScope = scopes.CreateScope();
        var queryDb = queryScope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        var ids = await queryDb.Orders.AsNoTracking().Where(o => o.ConfirmationEmailPending &&
            (o.Status == "APPROVED" || o.Status == "PAID_REQUIRES_REVIEW"))
            .OrderBy(o => o.IdOrder).Select(o => o.IdOrder).Take(20).ToListAsync(cancellationToken);
        foreach (var id in ids)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                // Skip rows being delivered by another API instance or worker.
                var rows = await db.Orders.FromSqlInterpolated($"""
                    SELECT * FROM "ORDERS" WHERE "Id_order" = {id} AND "ConfirmationEmailPending" = TRUE
                    AND "Status" IN ('APPROVED', 'PAID_REQUIRES_REVIEW') FOR UPDATE SKIP LOCKED
                    """).ToListAsync(cancellationToken);
                var order = rows.SingleOrDefault();
                if (order is null) continue;
                await db.Entry(order).Reference(o => o.Customer).LoadAsync(cancellationToken);
                await db.Entry(order).Collection(o => o.Items).LoadAsync(cancellationToken);
                if (string.IsNullOrWhiteSpace(order.Customer?.Email))
                    throw new InvalidOperationException($"La compra {id} no tiene un email de cliente.");
                await scope.ServiceProvider.GetRequiredService<IEmailService>().SendPurchaseConfirmationAsync(order.Customer.Email, order);
                order.ConfirmationEmailPending = false;
                order.ConfirmationEmailSentAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                logger.LogInformation("Confirmación de compra enviada para la orden {OrderId}.", id);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception exception) { logger.LogError(exception, "No se pudo enviar la confirmación de la orden {OrderId}; se reintentará.", id); }
        }
    }
}
