using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.Infrastructure.Services;

public class OrderCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);
    private readonly TimeSpan _staleThreshold = TimeSpan.FromMinutes(30);

    public OrderCleanupService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_checkInterval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var orderRepository = scope.ServiceProvider.GetRequiredService<IOrderRepository>();

                var cutoff = DateTime.UtcNow - _staleThreshold;
                var staleOrders = await orderRepository.GetStalePendingOrdersAsync(cutoff);

                if (staleOrders.Any())
                {
                    await orderRepository.CancelOrdersAsync(staleOrders);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                // El servicio sigue corriendo aunque falle un ciclo
            }
        }
    }
}
