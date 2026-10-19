using System.Security.Claims;
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

internal static class BackgroundPaymentChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        var payments = new BackgroundPayments();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(options);
        services.AddScoped<PaymentDbContext>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddSingleton<IPaymentService>(payments);
        services.AddScoped<IPaymentReconciliationService, PaymentReconciliationService>();
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        var worker = new PaymentReconciliationWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<PaymentReconciliationWorker>.Instance);
        await using var db = new PaymentDbContext(options);

        async Task<Order> Seed(string name, string status = "PENDING_PAYMENT", int stock = 1, string type = "PHYSICAL")
        {
            var product = new Product { ProductName = name, UnitPrice = 100, Type = type, Stock = stock };
            db.Products.Add(product); await db.SaveChangesAsync();
            var order = new Order { IdCustomer = customerId, TotalAmount = 100, Status = status,
                DatePurchase = DateTime.UtcNow.AddHours(-2), MercadoPagoPreferenceId = "background-test-" + name,
                Items = [new OrderItem { IdProduct = product.IdProduct, ProductType = type, ProductName = name,
                    Quantity = 1, FinalPrice = 100, DigitalFileKey = type == "DIGITAL" ? "products/purchased/book.pdf" : null }] };
            db.Orders.Add(order); await db.SaveChangesAsync();
            payments.Responses[order.IdOrder] = new VerifiedPayment(order.IdOrder + 1000, "approved", order.IdOrder.ToString(), 100, "ARS");
            return order;
        }

        var failed = await Seed("Provider unavailable");
        payments.Unavailable.Add(failed.IdOrder);
        var paid = await Seed("Browser closed");
        var digital = await Seed("Digital browser closed", type: "DIGITAL");
        var processing = await Seed("Processing", status: "PAYMENT_PROCESSING");
        var late = await Seed("Late cancelled", status: "CANCELLED", stock: 2);
        var review = await Seed("Late without stock", status: "REJECTED", stock: 0);
        var mismatch = await Seed("Wrong amount");
        payments.Responses[mismatch.IdOrder] = payments.Responses[mismatch.IdOrder]! with { Amount = 1 };
        var currency = await Seed("Wrong currency");
        payments.Responses[currency.IdOrder] = payments.Responses[currency.IdOrder]! with { Currency = "USD" };
        var reference = await Seed("Wrong reference");
        payments.Responses[reference.IdOrder] = payments.Responses[reference.IdOrder]! with { ExternalReference = paid.IdOrder.ToString() };
        var unpaid = await Seed("No payment"); payments.Responses[unpaid.IdOrder] = null;
        var waiting = await Seed("Still pending");
        payments.Responses[waiting.IdOrder] = payments.Responses[waiting.IdOrder]! with { Status = "pending" };
        var noPreference = await Seed("No preference"); noPreference.MercadoPagoPreferenceId = null;
        var alreadyPaid = await Seed("Already approved", status: "APPROVED");
        await db.SaveChangesAsync(); db.ChangeTracker.Clear();

        var storageConfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["R2:AccountId"] = "test-account", ["R2:AccessKeyId"] = "test-key",
            ["R2:SecretAccessKey"] = "test-secret", ["R2:BucketName"] = "private-test-bucket" }).Build();
        var downloads = new OrdersController(new OrderService(new OrderRepository(db)), db, new AssetStorage(storageConfig, new HttpClient())) {
            ControllerContext = new() { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(
                new ClaimsIdentity([new Claim("idCustomer", customerId.ToString())], "security-check")) } } };
        check(await downloads.Download(digital.Items.Single().IdOrderItem) is NotFoundResult, "unconfirmed digital purchase has no download before background confirmation");

        // No controller, browser, JWT, webhook, Redis or real provider participates in this cycle.
        await worker.ReconcilePendingAsync();
        async Task<Order> Reload(Order order) => await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == order.IdOrder);
        async Task<int> Stock(Order order) => (await db.Products.AsNoTracking().SingleAsync(p => p.IdProduct == order.Items.Single().IdProduct)).Stock;
        check((await Reload(paid)).Status == "APPROVED" && await Stock(paid) == 1,
            "background confirms physical payment after browser closes without changing reserved stock");
        check((await Reload(digital)).Status == "APPROVED" && await downloads.Download(digital.Items.Single().IdOrderItem) is OkObjectResult,
            "background approval unlocks purchased digital download without visiting result page");
        check((await Reload(paid)).ConfirmationEmailPending && (await Reload(digital)).ConfirmationEmailPending,
            "background approval queues existing confirmation email atomically");
        check((await Reload(processing)).Status == "APPROVED", "processing payments are confirmed in background");
        check((await Reload(late)).Status == "APPROVED" && await Stock(late) == 1,
            "background recovers late payment after cleanup cancelled and released stock");
        check((await Reload(review)).Status == "PAID_REQUIRES_REVIEW" && await Stock(review) == 0 && (await Reload(review)).ConfirmationEmailPending,
            "late paid order without stock requires review and queues notification");
        check((await Reload(mismatch)).Status == "PENDING_PAYMENT" && !(await Reload(mismatch)).ConfirmationEmailPending && await Stock(mismatch) == 1,
            "background mismatch cannot approve, email or modify stock");
        check((await Reload(currency)).Status == "PENDING_PAYMENT" && (await Reload(reference)).Status == "PENDING_PAYMENT",
            "background still verifies currency and exact order reference");
        check((await Reload(failed)).Status == "PENDING_PAYMENT" && (await Reload(paid)).Status == "APPROVED",
            "provider failure for one order does not prevent following orders from being confirmed");
        check((await Reload(unpaid)).Status == "PENDING_PAYMENT" && (await Reload(waiting)).Status == "PAYMENT_PROCESSING",
            "unpaid or pending provider payments never become approved in background");
        check(!payments.Searched.Contains(noPreference.IdOrder) && !payments.Searched.Contains(alreadyPaid.IdOrder),
            "worker excludes orders without preference and already confirmed orders");

        var sent = await db.Orders.SingleAsync(o => o.IdOrder == paid.IdOrder);
        sent.ConfirmationEmailPending = false; sent.ConfirmationEmailSentAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        payments.Unavailable.Clear();
        var paidSearches = payments.Searched.Count(id => id == paid.IdOrder);
        worker = new PaymentReconciliationWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<PaymentReconciliationWorker>.Instance);
        await worker.ReconcilePendingAsync();
        check((await Reload(failed)).Status == "APPROVED", "new worker cycle retries persisted failed payment without browser state");
        check(await Stock(late) == 1 && !(await Reload(paid)).ConfirmationEmailPending &&
            payments.Searched.Count(id => id == paid.IdOrder) == paidSearches,
            "restarted/repeated worker never deducts stock twice or requeues an already sent email");
    }

    private sealed class BackgroundPayments : IPaymentService
    {
        public Dictionary<int, VerifiedPayment?> Responses { get; } = [];
        public HashSet<int> Unavailable { get; } = [];
        public List<int> Searched { get; } = [];
        public Task<long?> FindPaymentIdForOrderAsync(Order order)
        {
            Searched.Add(order.IdOrder);
            if (Unavailable.Contains(order.IdOrder)) throw new HttpRequestException("Synthetic provider outage");
            return Task.FromResult(Responses.GetValueOrDefault(order.IdOrder)?.Id);
        }
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId) => Task.FromResult(Responses.Values.Single(p => p?.Id == paymentId)!);
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order) => throw new InvalidOperationException("Background checks must never create payments.");
    }
}
