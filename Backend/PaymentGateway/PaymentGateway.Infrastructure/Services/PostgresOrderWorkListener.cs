using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace PaymentGateway.Infrastructure.Services;

// LISTEN holds a dedicated connection; waiting for a notification issues no SQL polling.
public sealed class PostgresOrderWorkListener(IConfiguration config, OrderWorkSignal signal,
    ILogger<PostgresOrderWorkListener> logger) : BackgroundService
{
    private NpgsqlConnection? _connection;

    private async Task<NpgsqlConnection> ConnectAsync(CancellationToken cancellationToken)
    {
        var settings = new NpgsqlConnectionStringBuilder(config.GetConnectionString("DefaultConnection"))
        { Pooling = false, KeepAlive = 0 };
        var connection = new NpgsqlConnection(settings.ConnectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = '"ORDERS"'::regclass AND tgname = 'order_work_changed' AND NOT tgisinternal)
                AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payment_inbox_changed' AND NOT tgisinternal)
                """;
            if (await command.ExecuteScalarAsync(cancellationToken) is not true)
                throw new InvalidOperationException("Aplicá las migraciones OrderWorkNotifications y DurablePaymentNotifications antes de iniciar la API.");
            connection.Notification += (_, _) => signal.Pulse();
            command.CommandText = "LISTEN paymentgateway_order_work";
            await command.ExecuteNonQueryAsync(cancellationToken);
            // Recover durable jobs after startup or a disconnected listener, including missed events.
            signal.Pulse();
            return connection;
        }
        catch { await connection.DisposeAsync(); throw; }
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        _connection = await ConnectAsync(cancellationToken);
        await base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var failures = 0;
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _connection ??= await ConnectAsync(stoppingToken);
                    failures = 0;
                    await _connection.WaitAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                catch (Exception exception)
                {
                    logger.LogError(exception, "Se perdió la escucha de órdenes; se reconectará y recuperará el trabajo persistido.");
                    if (_connection is not null) await _connection.DisposeAsync();
                    _connection = null;
                    signal.Pulse();
                    await Task.Delay(TimeSpan.FromSeconds(Math.Min(Math.Pow(2, Math.Min(failures++, 6)), 60)), stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        finally { if (_connection is not null) await _connection.DisposeAsync(); }
    }
}
