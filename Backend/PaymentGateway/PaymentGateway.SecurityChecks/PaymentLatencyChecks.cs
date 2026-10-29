using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class PaymentLatencyChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool,string> check)
    {
        await using var db = new PaymentDbContext(options);
        var order = new Order { IdCustomer = customerId, Status = "PENDING_PAYMENT", MercadoPagoPreferenceId = "latency-fixture",
            TotalAmount = 100, ExpiresAt = DateTime.UtcNow.AddMinutes(20), NextPaymentCheckAt = DateTime.UtcNow.AddMinutes(5) };
        db.Orders.Add(order); await db.SaveChangesAsync();
        var fake = new Payments { Result = new(7001, "approved", order.IdOrder.ToString(), 100, "ARS", DateTime.UtcNow) };
        var services = new ServiceCollection(); services.AddSingleton(options); services.AddScoped<PaymentDbContext>();
        services.AddScoped<IOrderRepository, OrderRepository>(); services.AddSingleton<IPaymentService>(fake);
        services.AddScoped<IPaymentReconciliationService, PaymentReconciliationService>(); services.AddLogging();
        using var provider = services.BuildServiceProvider();
        var signal = new OrderWorkSignal();
        using var worker = new PaymentNotificationWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<PaymentNotificationWorker>.Instance, signal);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["MercadoPago:WebhookSecret"] = "latency-only-secret" }).Build();
        CheckoutController Controller(PaymentDbContext context, int? owner = null)
        {
            var repo = new OrderRepository(context);
            var controller = new CheckoutController(repo, fake, context, config, NullLogger<CheckoutController>.Instance,
                new PaymentReconciliationService(repo, fake, context, NullLogger<PaymentReconciliationService>.Instance));
            controller.ControllerContext = new() { HttpContext = new DefaultHttpContext() };
            if (owner is not null) controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", owner.ToString()!)], "test"));
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            controller.Request.QueryString = new("?data.id=7001"); controller.Request.Headers["x-request-id"] = "latency-check";
            var hash = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes("latency-only-secret"), Encoding.UTF8.GetBytes($"id:7001;request-id:latency-check;ts:{timestamp};")));
            controller.Request.Headers["x-signature"] = $"ts={timestamp},v1={hash}";
            return controller;
        }
        var payload = new WebhookPayload { Id = JsonSerializer.SerializeToElement("one"), Action = "payment.updated", Data = new() { Id = "7001" } };
        fake.Fail = true;
        var result = await Controller(db).ReceiveWebhook(payload);
        check(result is OkResult && fake.Reads == 0 && await db.PaymentNotifications.AnyAsync(n => n.PaymentId == 7001),
            "Latency: signed webhook is durably acknowledged without waiting for or calling a failing provider");
        await Task.WhenAll(Enumerable.Range(0, 16).Select(async _ => {
            await using var context = new PaymentDbContext(options);
            await new PaymentWebhookInbox(context).EnqueueAsync(7001, "payment.updated:one");
        }));
        check((await db.PaymentNotifications.AsNoTracking().SingleAsync(n => n.PaymentId == 7001)).Version == 1,
            "Latency: concurrent duplicate receipts produce one durable payment job");
        var invalid = Controller(db); invalid.Request.Headers["x-signature"] = "ts=1,v1=invalid";
        check(await invalid.ReceiveWebhook(payload) is UnauthorizedResult && fake.Reads == 0, "Latency: invalid signatures never enqueue provider work");
        await worker.ProcessPendingAsync();
        var entry = await db.PaymentNotifications.AsNoTracking().SingleAsync(n => n.PaymentId == 7001);
        check(entry.NextAttemptAt > DateTime.UtcNow && entry.ProcessedVersion == 0 && fake.Reads == 1,
            "Latency: provider failure preserves the receipt and schedules bounded retry");
        fake.Fail = false;
        await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:two");
        await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:three");
        await worker.ProcessPendingAsync(); db.ChangeTracker.Clear();
        var stored = await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == order.IdOrder);
        entry = await db.PaymentNotifications.AsNoTracking().SingleAsync(n => n.PaymentId == 7001);
        check(stored.Status == "APPROVED" && stored.ConfirmationEmailPending && fake.Searches == 0 && fake.Reads == 2 && entry.NextAttemptAt == null && entry.ProcessedVersion == 3,
            "Latency: coalesced updates verify directly by ID and confirm immediately despite a five-minute fallback schedule");
        await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:three"); await worker.ProcessPendingAsync();
        check(fake.Reads == 2, "Latency: replay of an already processed notification makes no provider request");
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        fake.Pause = async () => { started.TrySetResult(); await release.Task; };
        await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:four");
        var first = worker.ProcessPendingAsync(); await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await new PaymentNotificationWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<PaymentNotificationWorker>.Instance, signal).ProcessPendingAsync();
        check(fake.Reads == 3, "Latency: advisory lock prevents parallel instances from verifying the same queued payment");
        await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:five"); release.SetResult(); await first;
        fake.Pause = null; await worker.ProcessPendingAsync();
        entry = await db.PaymentNotifications.AsNoTracking().SingleAsync(n => n.PaymentId == 7001);
        check(fake.Reads == 4 && entry.ProcessedVersion == entry.Version && entry.NextAttemptAt == null,
            "Latency: an update arriving during verification is retained and processed after the active version");
        fake.DeferUntil = DateTime.UtcNow.AddMinutes(2);
        await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:six"); await worker.ProcessPendingAsync();
        entry = await db.PaymentNotifications.AsNoTracking().SingleAsync(n => n.PaymentId == 7001);
        check(entry.NextAttemptAt >= fake.DeferUntil?.AddMilliseconds(-1) && entry.ProcessedVersion < entry.Version,
            "Latency: shared provider deferral persists its retry deadline instead of issuing repeated requests");
        fake.DeferUntil = null;
        // Isolate the recovery fixture from earlier notification work.
        var recoveryOrder = new Order { IdCustomer = customerId, Status = "PENDING_PAYMENT", MercadoPagoPreferenceId = "bounded-recovery",
            TotalAmount = 100, ExpiresAt = DateTime.UtcNow.AddMinutes(20), NextPaymentCheckAt = DateTime.UtcNow.AddMinutes(5) };
        db.Orders.Add(recoveryOrder); await db.SaveChangesAsync();
        var before = fake.Reads;
        await Task.WhenAll(Enumerable.Range(0, 8).Select(async _ => { await using var context = new PaymentDbContext(options); await Controller(context, customerId).RequestRecovery(recoveryOrder.IdOrder); }));
        var recovery = await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == recoveryOrder.IdOrder);
        check(recovery.FastRecoveryRemaining == 2 && recovery.NextPaymentCheckAt <= DateTime.UtcNow && fake.Reads == before,
            "Latency: many browser returns schedule at most two fast attempts without making provider requests in HTTP handlers");
        check(await Controller(db, int.MaxValue).RequestRecovery(recoveryOrder.IdOrder) is NotFoundResult,
            "Latency: return recovery enforces ownership before touching another customer's schedule");
        var reconciliation = new PaymentReconciliationService(new OrderRepository(db), fake, db, NullLogger<PaymentReconciliationService>.Instance);
        await reconciliation.ReconcileAsync(null, recovery);
        recovery = await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == recoveryOrder.IdOrder);
        check(recovery.FastRecoveryRemaining == 1 && recovery.NextPaymentCheckAt <= DateTime.UtcNow.AddSeconds(31),
            "Latency: first recovery attempt schedules the second within 30 seconds");
        await db.Orders.Where(o => o.IdOrder == recovery.IdOrder).ExecuteUpdateAsync(u => u.SetProperty(o => o.NextPaymentCheckAt, DateTime.UtcNow.AddSeconds(-1)));
        await reconciliation.ReconcileAsync(null, recovery);
        await Controller(db, customerId).RequestRecovery(recovery.IdOrder);
        recovery = await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == recoveryOrder.IdOrder);
        check(recovery.FastRecoveryRemaining == 0 && recovery.NextPaymentCheckAt > DateTime.UtcNow.AddSeconds(40),
            "Latency: repeated returns cannot reset the two-attempt limit; normal backoff resumes");
        // A notification releases an authenticated long read after the persisted status changes.
        var statusController = new OrderController(db, signal) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        statusController.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", customerId.ToString())], "test"));
        var watch = statusController.Get(recovery.IdOrder, "PENDING_PAYMENT", true);
        await Task.Delay(50); check(!watch.IsCompleted, "Latency: long status read waits without contacting Mercado Pago");
        await using (var update = new PaymentDbContext(options)) await update.Orders.Where(o => o.IdOrder == recovery.IdOrder).ExecuteUpdateAsync(u => u.SetProperty(o => o.Status, "PAYMENT_PROCESSING"));
        signal.Pulse();
        var view = await watch.WaitAsync(TimeSpan.FromSeconds(3));
        check(view is OkObjectResult ok && JsonSerializer.Serialize(ok.Value).Contains("PAYMENT_PROCESSING"),
            "Latency: committed status notification reaches the waiting client without the frontend backoff delay");
        await db.PaymentNotifications.Where(n => n.PaymentId == 7001).ExecuteDeleteAsync();
        var listenerConfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["ConnectionStrings:DefaultConnection"] = db.Database.GetConnectionString() }).Build();
        using var listener = new PostgresOrderWorkListener(listenerConfig, signal, NullLogger<PostgresOrderWorkListener>.Instance);
        await listener.StartAsync(CancellationToken.None); await worker.StartAsync(CancellationToken.None);
        try
        {
            var baseline = fake.Reads;
            await new PaymentWebhookInbox(db).EnqueueAsync(7001, "payment.updated:wake-listener");
            var timeout = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < timeout && await db.PaymentNotifications.AsNoTracking().AnyAsync(n => n.PaymentId == 7001 && n.NextAttemptAt != null)) await Task.Delay(30);
            check(fake.Reads == baseline + 1 && await db.PaymentNotifications.AsNoTracking().AnyAsync(n => n.PaymentId == 7001 && n.NextAttemptAt == null),
                "Latency: real PostgreSQL commit notification wakes an idle hosted inbox worker without polling the provider");
        }
        finally { await worker.StopAsync(CancellationToken.None); await listener.StopAsync(CancellationToken.None); }
    }

    private sealed class Payments : IPaymentService
    {
        public VerifiedPayment Result { get; set; } = null!;
        public bool Fail { get; set; }
        public DateTime? DeferUntil { get; set; }
        public Func<Task>? Pause { get; set; }
        public int Reads, Searches;
        public async Task<VerifiedPayment> VerifyPaymentStatusAsync(long id)
        { Interlocked.Increment(ref Reads); if (Pause is not null) await Pause(); if (DeferUntil is { } due) throw new PaymentProviderDeferredException(due); if (Fail) throw new HttpRequestException(); return Result; }
        public Task<long?> FindPaymentIdForOrderAsync(Order order) { Interlocked.Increment(ref Searches); return Task.FromResult<long?>(null); }
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order) => throw new NotSupportedException();
    }
}
