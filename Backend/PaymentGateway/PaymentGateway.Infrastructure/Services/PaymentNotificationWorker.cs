using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentNotificationWorker(IServiceScopeFactory scopes, ILogger<PaymentNotificationWorker> logger, OrderWorkSignal signal)
    : ScheduledOrderWorker(signal, logger, TimeSpan.FromSeconds(2))
{
    protected override async Task<DateTime?> RunAndGetNextAsync(CancellationToken cancellationToken)
    {
        await ProcessPendingAsync(cancellationToken);
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        return await db.PaymentNotifications.MinAsync(n => n.NextAttemptAt, cancellationToken);
    }

    public async Task ProcessPendingAsync(CancellationToken cancellationToken = default)
    {
        using var queryScope = scopes.CreateScope();
        var query = queryScope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        var now = DateTime.UtcNow;
        var ids = await query.PaymentNotifications.AsNoTracking().Where(n => n.NextAttemptAt <= now)
            .OrderBy(n => n.NextAttemptAt).Take(50).Select(n => n.PaymentId).ToListAsync(cancellationToken);
        await Parallel.ForEachAsync(ids, new ParallelOptions { MaxDegreeOfParallelism = 2, CancellationToken = cancellationToken }, async (id, _) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            await db.Database.OpenConnectionAsync(cancellationToken);
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = $"SELECT pg_try_advisory_lock(hashtextextended('payment-inbox/{id}', 0))";
            if (await command.ExecuteScalarAsync(cancellationToken) is not true) return;
            try
            {
                var entry = await db.PaymentNotifications.AsNoTracking().SingleAsync(n => n.PaymentId == id, cancellationToken);
                if (entry.NextAttemptAt is null || entry.NextAttemptAt > DateTime.UtcNow) return;
                // Recover even if the process dies after the provider call, without a long database transaction.
                await db.PaymentNotifications.Where(n => n.PaymentId == id && n.Version == entry.Version)
                    .ExecuteUpdateAsync(u => u.SetProperty(n => n.NextAttemptAt, DateTime.UtcNow.AddSeconds(30)), cancellationToken);
                var result = PaymentReconciliationResult.Unavailable;
                DateTime? deferUntil = null;
                try
                {
                    using var priority = PaymentRequestPriority.Urgent();
                    result = await scope.ServiceProvider.GetRequiredService<IPaymentReconciliationService>().ReconcileAsync(id);
                }
                catch (PaymentProviderDeferredException ex) { deferUntil = ex.RetryAt; }
                catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
                { logger.LogWarning("Error al procesar aviso del pago {PaymentId}: {ErrorType}.", id, ex.GetType().Name); }
                var finished = DateTime.UtcNow;
                var accepted = result == PaymentReconciliationResult.Success;
                // Invalid/mismatched/not-found events need operator review, not an endless request loop.
                var terminal = accepted || result is PaymentReconciliationResult.Mismatch or PaymentReconciliationResult.NotFound;
                DateTime? next = terminal ? null : deferUntil ?? finished.AddSeconds(Math.Min(300, 5 * Math.Pow(2, Math.Min(entry.Attempts, 6))) + Random.Shared.NextDouble());
                await db.PaymentNotifications.Where(n => n.PaymentId == id && n.Version == entry.Version)
                    .ExecuteUpdateAsync(u => u.SetProperty(n => n.Attempts, n => n.Attempts + 1)
                        .SetProperty(n => n.ProcessedVersion, terminal ? entry.Version : entry.ProcessedVersion)
                        .SetProperty(n => n.ProcessedAt, terminal ? finished : entry.ProcessedAt)
                        .SetProperty(n => n.NextAttemptAt, next), cancellationToken);
                logger.LogInformation("Aviso pago {PaymentId}, versión {Version}: {Result}; latencia recepción/proceso {LatencyMs} ms; próxima consulta {NextAttempt}.",
                    id, entry.Version, result, (finished - entry.LastReceivedAt).TotalMilliseconds, next);
            }
            finally
            {
                command.CommandText = $"SELECT pg_advisory_unlock(hashtextextended('payment-inbox/{id}', 0))";
                await command.ExecuteScalarAsync(CancellationToken.None);
            }
        });
        // Retention is applied on the next queue wake-up; no idle polling is introduced.
        await query.PaymentNotificationEvents.Where(e => e.ReceivedAt < now.AddDays(-7)).ExecuteDeleteAsync(cancellationToken);
        await query.PaymentNotifications.Where(e => e.NextAttemptAt == null && e.LastReceivedAt < now.AddDays(-7)).ExecuteDeleteAsync(cancellationToken);
    }
}
