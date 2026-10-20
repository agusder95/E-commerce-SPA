using System.Data.Common;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;

internal static class CheckoutConcurrencyChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId,
        Action<bool, string> check)
    {
        await using var verification = new PaymentDbContext(options);
        var product = new Product { ProductName = "Last unit concurrency check", Type = "PHYSICAL", Stock = 1, UnitPrice = 100m };
        verification.Products.Add(product);
        await verification.SaveChangesAsync();

        var barrier = new ProductReadBarrier();
        var concurrentOptions = new DbContextOptionsBuilder<PaymentDbContext>(options).AddInterceptors(barrier).Options;
        await using var firstDb = new PaymentDbContext(concurrentOptions);
        await using var secondDb = new PaymentDbContext(concurrentOptions);
        var payment = new CheckoutPayment();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["MercadoPago:WebhookSecret"] = "concurrency-check-only",
            ["Store:WebhookUrl"] = "https://example.com/api/checkout/webhook"
        }).Build();

        CheckoutController Controller(PaymentDbContext db) => new(new OrderRepository(db), payment, db, config,
            NullLogger<CheckoutController>.Instance, null!)
        {
            ControllerContext = new() { HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", customerId.ToString())], "check"))
            } }
        };
        var request = new CreateOrderRequest { Items = [new() { IdProduct = product.IdProduct, Quantity = 1 }] };
        var results = await Task.WhenAll(Controller(firstDb).CreateFinalOrder(request), Controller(secondDb).CreateFinalOrder(request))
            .WaitAsync(TimeSpan.FromSeconds(30));
        check(results.Count(result => result is OkObjectResult) == 1 &&
            results.Count(result => result is ConflictObjectResult) == 1,
            "simultaneous checkouts for the last unit return one success and one 409 instead of 500");
        var conflict = (ConflictObjectResult)results.Single(result => result is ConflictObjectResult);
        var body = JsonSerializer.SerializeToElement(conflict.Value);
        check(body.GetProperty("Code").GetString() == "CHECKOUT_CONFLICT" &&
            body.GetProperty("Message").GetString()!.Contains("Revisá el carrito"),
            "checkout concurrency response includes a stable code and actionable user message");
        check(await verification.Products.AsNoTracking().Where(p => p.IdProduct == product.IdProduct).Select(p => p.Stock).SingleAsync() == 0 &&
            await verification.Orders.CountAsync(o => o.Items.Any(i => i.IdProduct == product.IdProduct)) == 1 && payment.Preferences == 1,
            "losing checkout rolls back its order and only the winner reserves stock and creates a payment preference");
        var storedOrder = await verification.Orders.AsNoTracking().SingleAsync(o => o.Items.Any(i => i.IdProduct == product.IdProduct));
        check(storedOrder.ExpiresAt == storedOrder.DatePurchase.AddMinutes(20) && storedOrder.NextPaymentCheckAt is not null,
            "new checkout persists a 20-minute reservation and schedules its first backup check");
        var statusController = new OrderController(verification)
        {
            ControllerContext = new() { HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", customerId.ToString())], "check"))
            } }
        };
        var status = (OkObjectResult)await statusController.Get(storedOrder.IdOrder);
        var statusBody = JsonSerializer.SerializeToElement(status.Value);
        check(statusBody.GetProperty("ExpiresAt").GetDateTime() == storedOrder.ExpiresAt && payment.Preferences == 1,
            "frontend status endpoint exposes the persisted expiration without calling the payment provider");
        statusController.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", int.MaxValue.ToString())], "check"));
        check(await statusController.Get(storedOrder.IdOrder) is NotFoundResult,
            "status polling cannot read another customer's order or its payment link");
        statusController.HttpContext.User = new ClaimsPrincipal();
        check(await statusController.Get(storedOrder.IdOrder) is UnauthorizedResult,
            "status polling requires the authenticated customer claim");

        await using var laterDb = new PaymentDbContext(options);
        var later = await Controller(laterDb).CreateFinalOrder(request);
        check(later is BadRequestObjectResult bad &&
            JsonSerializer.SerializeToElement(bad.Value).GetProperty("Code").GetString() == "PRODUCTS_UNAVAILABLE",
            "checkout after reservation still returns the existing out-of-stock response");
    }

    // Both SELECTs must reach PostgreSQL before either checkout can update the product.
    private sealed class ProductReadBarrier : DbCommandInterceptor
    {
        private readonly TaskCompletionSource _bothRead = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _reads;

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command,
            CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("FROM \"PRODUCTS\"") && command.CommandText.TrimStart().StartsWith("SELECT"))
            {
                if (Interlocked.Increment(ref _reads) == 2) _bothRead.TrySetResult();
                await _bothRead.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
            }
            return result;
        }
    }

    private sealed class CheckoutPayment : IPaymentService
    {
        private int _preferences;
        public int Preferences => _preferences;
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order)
        {
            Interlocked.Increment(ref _preferences);
            return Task.FromResult(new PaymentPreferenceResponse
            {
                PreferenceId = "concurrency-check", InitPoint = "https://example.com/pay"
            });
        }
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId) => throw new NotSupportedException();
        public Task<long?> FindPaymentIdForOrderAsync(Order order) => throw new NotSupportedException();
    }
}
