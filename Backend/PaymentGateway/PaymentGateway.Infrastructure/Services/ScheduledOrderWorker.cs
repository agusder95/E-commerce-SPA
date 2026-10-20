using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace PaymentGateway.Infrastructure.Services;

public abstract class ScheduledOrderWorker(OrderWorkSignal signal, ILogger logger, TimeSpan retryDelay) : BackgroundService
{
    protected abstract Task<DateTime?> RunAndGetNextAsync(CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var failures = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            var version = signal.Version;
            TimeSpan? delay;
            try
            {
                var next = await RunAndGetNextAsync(stoppingToken);
                failures = 0;
                var now = DateTime.UtcNow;
                // Locked/failed jobs may still be due: do not spin while another instance works.
                delay = next is null ? null : next > now ? next.Value - now : retryDelay;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception)
            {
                logger.LogError(exception, "No se pudo procesar {Worker}; se reintentará con espera creciente.", GetType().Name);
                delay = TimeSpan.FromSeconds(Math.Min(retryDelay.TotalSeconds * Math.Pow(2, Math.Min(failures++, 8)), 300));
            }
            try { await signal.WaitAsync(version, delay, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
        }
    }
}
