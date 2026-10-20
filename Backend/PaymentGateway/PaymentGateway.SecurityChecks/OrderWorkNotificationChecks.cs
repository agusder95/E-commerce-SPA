using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class OrderWorkNotificationChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        // This is the last check in an isolated temporary database. Empty the existing fixture queues.
        await db.Orders.ExecuteUpdateAsync(update => update.SetProperty(o => o.NextPaymentCheckAt, (DateTime?)null)
            .SetProperty(o => o.Status, "APPROVED").SetProperty(o => o.ConfirmationEmailPending, false));
        var commands = new CommandCounter();
        var measured = new DbContextOptionsBuilder<PaymentDbContext>(options).AddInterceptors(commands).Options;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = db.Database.GetConnectionString()
        }).Build();
        var payments = new NoPayment(); var email = new TestEmail();
        var services = new ServiceCollection();
        services.AddLogging(); services.AddSingleton(measured); services.AddScoped<PaymentDbContext>();
        services.AddSingleton<IOptions<PaymentTrackingOptions>>(Options.Create(new PaymentTrackingOptions()));
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IPaymentReconciliationService, PaymentReconciliationService>();
        services.AddSingleton<IPaymentService>(payments); services.AddSingleton<IEmailService>(email);
        using var provider = services.BuildServiceProvider();
        var scopes = provider.GetRequiredService<IServiceScopeFactory>();
        var signal = new OrderWorkSignal(); var secondSignal = new OrderWorkSignal();
        PostgresOrderWorkListener Listener(OrderWorkSignal work) => new(config, work, NullLogger<PostgresOrderWorkListener>.Instance);
        var listener = Listener(signal);
        using var secondListener = Listener(secondSignal);
        using var reconciliation = new PaymentReconciliationWorker(scopes, NullLogger<PaymentReconciliationWorker>.Instance, signal: signal);
        using var cleanup = new OrderCleanupService(scopes, NullLogger<OrderCleanupService>.Instance, signal: signal);
        using var mailer = new PurchaseEmailService(scopes, NullLogger<PurchaseEmailService>.Instance, signal);
        try
        {
            await listener.StartAsync(default); await secondListener.StartAsync(default);
            await reconciliation.StartAsync(default); await cleanup.StartAsync(default); await mailer.StartAsync(default);
            await Until(() => Task.FromResult(commands.Count >= 7), "initial queue discovery");
            await Task.Delay(100);
            var baseline = commands.Count;
            Console.WriteLine("Observing idle payment, expiration and email workers for 16 seconds...");
            await Task.Delay(TimeSpan.FromSeconds(16));
            check(commands.Count == baseline && payments.Searches == 0 && email.Deliveries == 0,
                "empty queues issue zero recurring SQL/provider/email requests across the old 15-second polling interval");

            var firstVersion = signal.Version; var secondVersion = secondSignal.Version;
            var existingId = await db.Orders.Select(o => o.IdOrder).FirstAsync();
            await using (var transaction = await db.Database.BeginTransactionAsync())
            {
                await db.Orders.Where(o => o.IdOrder == existingId).ExecuteUpdateAsync(update => update.SetProperty(o => o.Status, "PENDING_PAYMENT"));
                await transaction.RollbackAsync();
            }
            await db.Orders.Where(o => o.IdOrder == existingId).ExecuteUpdateAsync(update => update.SetProperty(o => o.TotalAmount, 123m));
            await Task.Delay(100);
            check(signal.Version == firstVersion && secondSignal.Version == secondVersion && commands.Count == baseline,
                "rolled-back work and updates unrelated to queue scheduling do not wake idle workers");

            var product = new Product { ProductName = "Event-driven reservation", Type = "PHYSICAL", UnitPrice = 100, Stock = 0 };
            var now = DateTime.UtcNow;
            var order = new Order { IdCustomer = customerId, Status = "PENDING_PAYMENT", TotalAmount = 100,
                MercadoPagoPreferenceId = "event-driven-check", ExpiresAt = now.AddSeconds(2), NextPaymentCheckAt = now.AddMilliseconds(250),
                Items = [new() { Product = product, ProductName = product.ProductName, ProductType = "PHYSICAL", Quantity = 1, FinalPrice = 100 }] };
            db.Orders.Add(order); await db.SaveChangesAsync();
            await Until(async () => (await Reload()).PaymentCheckAttempts > 0, "new-order notification");
            check(payments.Searches > 0 && secondSignal.Version > secondVersion,
                "a committed new order wakes waiting API instances and schedules verification without any logged-in user");
            await Until(async () => (await Reload()).Status == "CANCELLED", "reservation expiration");
            check(await db.Products.AsNoTracking().Where(p => p.IdProduct == product.IdProduct).Select(p => p.Stock).SingleAsync() == 1,
                "sleeping workers wake at the persisted deadline and release an unpaid reservation exactly once");
            Task<Order> Reload() => db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == order.IdOrder);

            // Remove the scheduled cancelled-order recovery before testing an idle listener reconnect.
            await db.Orders.Where(o => o.IdOrder == order.IdOrder).ExecuteUpdateAsync(update => update.SetProperty(o => o.NextPaymentCheckAt, (DateTime?)null));
            await Task.Delay(150);
            await listener.StopAsync(default); listener.Dispose();
            var approved = new Order { IdCustomer = customerId, Status = "APPROVED", TotalAmount = 100, ConfirmationEmailPending = true };
            db.Orders.Add(approved); await db.SaveChangesAsync();
            await Task.Delay(100);
            check(email.Deliveries == 0, "disconnected listener leaves work durable instead of sending from an unobserved event");
            listener = Listener(signal); await listener.StartAsync(default);
            await Until(async () => await db.Orders.AnyAsync(o => o.IdOrder == approved.IdOrder && o.ConfirmationEmailSentAt != null),
                "listener reconnect recovery");
            check(email.Deliveries == 1, "listener startup/reconnect recovers a missed committed event and sends its confirmation once");

            var version = signal.Version;
            var waiting = signal.WaitAsync(version, null, default);
            signal.Pulse(); await waiting.WaitAsync(TimeSpan.FromSeconds(1));
            await signal.WaitAsync(version, null, default).WaitAsync(TimeSpan.FromSeconds(1));
            check(true, "broadcast revision prevents losing a notification between querying a queue and starting to wait");
        }
        finally
        {
            await reconciliation.StopAsync(default); await cleanup.StopAsync(default); await mailer.StopAsync(default);
            await listener.StopAsync(default); listener.Dispose(); await secondListener.StopAsync(default);
        }
    }

    private static async Task Until(Func<Task<bool>> condition, string operation)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (!await condition())
        {
            if (DateTime.UtcNow >= deadline) throw new InvalidOperationException("Timed out waiting for " + operation);
            await Task.Delay(20);
        }
    }

    private sealed class CommandCounter : DbCommandInterceptor
    {
        private int _count;
        public int Count => Volatile.Read(ref _count);
        public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            DbDataReader result, CancellationToken cancellationToken = default)
        { Interlocked.Increment(ref _count); return ValueTask.FromResult(result); }
        public override ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            int result, CancellationToken cancellationToken = default)
        { Interlocked.Increment(ref _count); return ValueTask.FromResult(result); }
        public override ValueTask<object?> ScalarExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            object? result, CancellationToken cancellationToken = default)
        { Interlocked.Increment(ref _count); return ValueTask.FromResult(result); }
    }
    private sealed class NoPayment : IPaymentService
    {
        private int _searches;
        public int Searches => Volatile.Read(ref _searches);
        public Task<long?> FindPaymentIdForOrderAsync(Order order) { Interlocked.Increment(ref _searches); return Task.FromResult<long?>(null); }
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId) => throw new NotSupportedException();
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order) => throw new NotSupportedException();
    }
    private sealed class TestEmail : IEmailService
    {
        private int _deliveries;
        public int Deliveries => Volatile.Read(ref _deliveries);
        public Task SendPinEmailAsync(string toEmail, string pin) => throw new NotSupportedException();
        public Task SendPurchaseConfirmationAsync(string toEmail, Order order) { Interlocked.Increment(ref _deliveries); return Task.CompletedTask; }
    }
}
