using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class PaymentSchedulingChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var settings = new PaymentTrackingOptions { BatchSize = 2 };
        var configured = Options.Create(settings);
        var payments = new ScheduledPayments();
        PaymentReconciliationService Service(PaymentDbContext context) => new(new OrderRepository(context, configured),
            payments, context, NullLogger<PaymentReconciliationService>.Instance, configured);
        async Task<Order> Seed(string status = "PENDING_PAYMENT", bool expired = false, bool hasPayment = false)
        {
            var now = DateTime.UtcNow;
            var product = new Product { ProductName = "Scheduled payment", Type = "PHYSICAL", UnitPrice = 100, Stock = 0 };
            var order = new Order { IdCustomer = customerId, TotalAmount = 100, Status = status,
                DatePurchase = expired ? now.AddMinutes(-21) : now,
                ExpiresAt = expired ? now.AddMinutes(-1) : now.AddMinutes(settings.ReservationMinutes),
                NextPaymentCheckAt = now.AddSeconds(-1), MercadoPagoPreferenceId = Guid.NewGuid().ToString(),
                Items = [new OrderItem { Product = product, ProductType = "PHYSICAL", ProductName = product.ProductName,
                    Quantity = 1, OriginalUnitPrice = 100, FinalPrice = 100 }] };
            db.Orders.Add(order); await db.SaveChangesAsync();
            payments.Results[order.IdOrder] = new(order.IdOrder + 100000L, "approved", order.IdOrder.ToString(), 100, "ARS");
            if (hasPayment) payments.HasPayment.Add(order.IdOrder);
            return order;
        }
        async Task<Order> Reload(Order order) => await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == order.IdOrder);
        async Task<int> Stock(Order order) => await db.Products.AsNoTracking().Where(p => p.IdProduct == order.Items.Single().IdProduct)
            .Select(p => p.Stock).SingleAsync();
        async Task Due(Order order) => await db.Orders.Where(o => o.IdOrder == order.IdOrder).ExecuteUpdateAsync(update =>
            update.SetProperty(o => o.NextPaymentCheckAt, DateTime.UtcNow.AddSeconds(-1)));
        async Task<PaymentReconciliationResult> Reconcile(Order order, long? paymentId = null)
        {
            await using var context = new PaymentDbContext(options);
            return await Service(context).ReconcileAsync(paymentId, paymentId is null ? order : null);
        }

        check(settings.ReservationMinutes == 20 && settings.Delay(1).TotalSeconds == 30 && settings.Delay(2).TotalSeconds == 60 &&
            settings.Delay(3).TotalSeconds == 120 && settings.Delay(20).TotalSeconds == 300,
            "reservation defaults to 20 minutes and provider checks progressively back off to five minutes");
        var pending = await Seed();
        await Reconcile(pending);
        var scheduled = await Reload(pending);
        check(scheduled.PaymentCheckAttempts == 1 && scheduled.LastPaymentCheckAt is not null && scheduled.NextPaymentCheckAt > DateTime.UtcNow,
            "no-payment response persists the next attempt and last check instead of continuously querying provider");
        var searches = payments.Searches.Count;
        await Reconcile(pending); await Reconcile(pending);
        check(payments.Searches.Count == searches && (await Reload(pending)).PaymentCheckAttempts == 1,
            "separate HTTP requests and backend instances share the same persisted polling limit");
        await Due(pending); await Reconcile(pending);
        check((await Reload(pending)).PaymentCheckAttempts == 2 &&
            (await Reload(pending)).NextPaymentCheckAt > DateTime.UtcNow.AddSeconds(55),
            "due checks resume with increasing delay after a fresh service instance");

        var failing = await Seed(); payments.Unavailable.Add(failing.IdOrder);
        check(await Reconcile(failing) == PaymentReconciliationResult.Unavailable &&
            (await Reload(failing)).NextPaymentCheckAt > DateTime.UtcNow.AddSeconds(55) && await Stock(failing) == 0,
            "provider outages use a longer persisted delay and preserve the reservation");

        var expired = await Seed(expired: true);
        await Reconcile(expired);
        check((await Reload(expired)).Status == "CANCELLED" && await Stock(expired) == 1,
            "expired unpaid reservation is cancelled only after checking provider and returns stock");
        await Due(expired); await Reconcile(expired);
        check(await Stock(expired) == 1, "repeated reconciliation of an expired reservation does not release stock twice");

        var nearDeadline = await Seed();
        var deadline = DateTime.UtcNow.AddSeconds(5);
        await db.Orders.Where(o => o.IdOrder == nearDeadline.IdOrder).ExecuteUpdateAsync(update => update.SetProperty(o => o.ExpiresAt, deadline));
        await Reconcile(nearDeadline);
        check((await Reload(nearDeadline)).NextPaymentCheckAt == (await Reload(nearDeadline)).ExpiresAt,
            "scheduled unpaid checks do not overshoot the reservation deadline");

        var processing = await Seed(expired: true, hasPayment: true);
        payments.Results[processing.IdOrder] = payments.Results[processing.IdOrder] with { Status = "in_process" };
        await Reconcile(processing);
        var storedProcessing = await Reload(processing);
        check(storedProcessing.Status == "PAYMENT_PROCESSING" && storedProcessing.PaymentId == payments.Results[processing.IdOrder].Id &&
            await Stock(processing) == 0, "processing payments retain their reservation after 20 minutes and persist a verified payment ID");
        searches = payments.Searches.Count;
        await Due(processing); await Reconcile(processing);
        check(payments.Searches.Count == searches, "processing payments reuse their verified ID without another preference search");

        // A webhook must bypass polling deadlines, including after automatic recovery has ended.
        var late = await Seed("CANCELLED", expired: true, hasPayment: true);
        await db.Products.Where(p => p.IdProduct == late.Items.Single().IdProduct).ExecuteUpdateAsync(update => update.SetProperty(p => p.Stock, 1));
        await db.Orders.Where(o => o.IdOrder == late.IdOrder).ExecuteUpdateAsync(update => update
            .SetProperty(o => o.ExpiresAt, DateTime.UtcNow.AddDays(-2))
            .SetProperty(o => o.NextPaymentCheckAt, (DateTime?)null)
            .SetProperty(o => o.LastPaymentCheckAt, DateTime.UtcNow.AddDays(-2)));
        check(await Reconcile(late, payments.Results[late.IdOrder].Id) == PaymentReconciliationResult.Success &&
            (await Reload(late)).Status == "APPROVED" && (await Reload(late)).NextPaymentCheckAt is null && await Stock(late) == 0,
            "trusted late webhook bypasses stopped recovery and safely reacquires stock");

        var simultaneous = await Seed(expired: true, hasPayment: true);
        payments.BlockOrder = simultaneous.IdOrder;
        var first = Reconcile(simultaneous);
        await payments.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        try
        {
            searches = payments.Searches.Count;
            await Reconcile(simultaneous);
            await using var otherDb = new PaymentDbContext(options);
            await new OrderRepository(otherDb, configured).CancelOrdersAsync([simultaneous]);
            check(payments.Searches.Count == searches && await Stock(simultaneous) == 0 && (await Reload(simultaneous)).Status == "PENDING_PAYMENT",
                "database order lock prevents duplicate provider searches and concurrent cleanup across instances");
            check(await Reconcile(simultaneous, payments.Results[simultaneous.IdOrder].Id) == PaymentReconciliationResult.Unavailable,
                "webhook racing an active reconciliation requests retry rather than losing its event");
        }
        finally { payments.Release.TrySetResult(); }
        await first.WaitAsync(TimeSpan.FromSeconds(10));
        check((await Reload(simultaneous)).Status == "APPROVED" && await Stock(simultaneous) == 0,
            "payment approval wins over expiration without releasing reserved stock");

        // Isolate the worker batch from fixtures created by other checks in this temporary database.
        await db.Orders.ExecuteUpdateAsync(update => update.SetProperty(o => o.NextPaymentCheckAt, (DateTime?)null));
        var old = await Seed("CANCELLED", expired: true);
        await db.Orders.Where(o => o.IdOrder == old.IdOrder).ExecuteUpdateAsync(update =>
            update.SetProperty(o => o.ExpiresAt, DateTime.UtcNow.AddDays(-2)));
        var firstBatch = await Seed(); var secondBatch = await Seed(); var thirdBatch = await Seed();
        var services = new ServiceCollection();
        services.AddLogging(); services.AddSingleton(options); services.AddScoped<PaymentDbContext>();
        services.AddSingleton<IOptions<PaymentTrackingOptions>>(configured);
        services.AddSingleton<IPaymentService>(payments);
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IPaymentReconciliationService, PaymentReconciliationService>();
        using var provider = services.BuildServiceProvider();
        var worker = new PaymentReconciliationWorker(provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<PaymentReconciliationWorker>.Instance, configured);
        searches = payments.Searches.Count;
        await worker.ReconcilePendingAsync();
        check(payments.Searches.Count == searches + 2 && (await Reload(thirdBatch)).PaymentCheckAttempts == 0 &&
            (await Reload(firstBatch)).PaymentCheckAttempts == 1 && (await Reload(secondBatch)).PaymentCheckAttempts == 1,
            "worker processes only a bounded batch of due orders");
        check((await Reload(old)).NextPaymentCheckAt is null && !payments.Searches.Contains(old.IdOrder),
            "historical cancelled orders stop recovery without querying provider");

        var cleanupOrder = await Seed(expired: true);
        var cleanup = new OrderCleanupService(provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<OrderCleanupService>.Instance, configured);
        await cleanup.CleanupExpiredAsync();
        check((await Reload(cleanupOrder)).Status == "CANCELLED" && await Stock(cleanupOrder) == 1,
            "cleanup and background verification use the same expiration and stock rules");
    }

    private sealed class ScheduledPayments : IPaymentService
    {
        public Dictionary<int, VerifiedPayment> Results { get; } = [];
        public HashSet<int> HasPayment { get; } = [];
        public HashSet<int> Unavailable { get; } = [];
        public List<int> Searches { get; } = [];
        public int? BlockOrder { get; set; }
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async Task<long?> FindPaymentIdForOrderAsync(Order order)
        {
            Searches.Add(order.IdOrder);
            if (order.IdOrder == BlockOrder)
            {
                Entered.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(10));
            }
            if (Unavailable.Contains(order.IdOrder)) throw new HttpRequestException("Synthetic provider outage");
            return HasPayment.Contains(order.IdOrder) ? Results[order.IdOrder].Id : null;
        }
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId) => Task.FromResult(Results.Values.Single(p => p.Id == paymentId));
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order) => throw new NotSupportedException();
    }
}
