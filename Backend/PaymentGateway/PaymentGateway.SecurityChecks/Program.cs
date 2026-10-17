using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MercadoPago.Error;
using MercadoPago.Config;
using MercadoPago.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using System.Text.Json;
using Npgsql;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

const string secret = "security-checks-only-not-a-real-credential";
var checks = 0;
var emailOrder = new Order { IdOrder = 42, Status = "APPROVED", TotalAmount = 250m,
    Items = [new() { ProductName = "Manual <especial>", ProductType = "DIGITAL", Quantity = 1, FinalPrice = 50m },
        new() { ProductName = "Libro", ProductType = "PHYSICAL", Quantity = 2, FinalPrice = 100m }] };
var emailContent = PurchaseEmail.Create(emailOrder, "https://tienda.example", "https://www.instagram.com/tienda/");
Check(emailContent.Text.Contains("Libro × 2: ARS 200,00") && emailContent.Text.Contains("Total pagado: ARS 250,00"),
    "purchase confirmation includes quantities, discounted line totals and final amount");
Check(emailContent.Html.Contains("Manual &lt;especial&gt;") && !emailContent.Html.Contains("Manual <especial>"),
    "purchase confirmation escapes product names in HTML");
Check(emailContent.Text.Contains("https://tienda.example/my-purchases") && emailContent.Text.Contains("iniciá sesión"),
    "purchase confirmation links to purchases with login instructions");
Check(emailContent.Text.Contains("presencial") && emailContent.Html.Contains("https://www.instagram.com/tienda/"),
    "mixed purchase includes physical pickup coordination on Instagram");
emailOrder.Items = [emailOrder.Items.First()];
emailContent = PurchaseEmail.Create(emailOrder, "https://tienda.example/", "https://www.instagram.com/tienda/");
Check(!emailContent.Text.Contains("Instagram") && emailContent.Text.Contains("archivos digitales"),
    "digital-only purchase describes downloads without physical delivery instructions");
emailOrder.Status = "PAID_REQUIRES_REVIEW";
Check(PurchaseEmail.Create(emailOrder, "https://tienda.example", null).Text.Contains("revisando la disponibilidad"),
    "late confirmed payment explains availability review");
// Exercise MVC's nested model validation, including implicit required fields.
var validationServices = new ServiceCollection();
validationServices.AddLogging();
validationServices.AddControllers();
using var validationProvider = validationServices.BuildServiceProvider();
var modelValidator = validationProvider.GetRequiredService<IObjectModelValidator>();
var orderRequest = JsonSerializer.Deserialize<CreateOrderRequest>(
    """{"couponCode":null,"items":[{"idProduct":1,"quantity":1}]}""", new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
Check(ValidateOrder(orderRequest).ModelState.IsValid, "checkout accepts only product ID and quantity, without client name, price, customer ID or address");
Check(!ValidateOrder(new CreateOrderRequest()).ModelState.IsValid, "empty checkout cart fails model validation");
Check(!ValidateOrder(new CreateOrderRequest { Items = [new() { IdProduct = 1, Quantity = 0 }] }).ModelState.IsValid,
    "invalid checkout quantity fails nested model validation");
Check(!ValidateOrder(new CreateOrderRequest { Items = [new() { IdProduct = 0, Quantity = 1 }] }).ModelState.IsValid,
    "missing product ID fails nested model validation");

ActionContext ValidateOrder(CreateOrderRequest request)
{
    var context = new ActionContext { HttpContext = new DefaultHttpContext { RequestServices = validationProvider } };
    modelValidator.Validate(context, null, "", request);
    return context;
}

var config = Configuration(secret);
// A request that should be rejected must never reach this unavailable database.
var options = new DbContextOptionsBuilder<PaymentDbContext>()
    .UseNpgsql("Host=127.0.0.1;Port=1;Database=unused;Username=unused;Timeout=1").Options;
await using var offlineDb = new PaymentDbContext(options);
var payment = new FakePayment();
var controller = Controller(offlineDb, payment, config);
var payload = Payload();

foreach (var value in new string?[] { null, "", " ", "replace-with-webhook-secret" })
{
    var unconfigured = Controller(offlineDb, payment, Configuration(value));
    Check(Code(await unconfigured.ReceiveWebhook(payload)) == 503, "missing/placeholder secret blocks webhook");
    Check(Code(await unconfigured.CreateFinalOrder(new CreateOrderRequest())) == 503, "missing secret blocks checkout before database/preference");
}
Check(payment.Lookups == 0 && payment.Preferences == 0, "unconfigured payments never contact provider");
var anonymous = Controller(offlineDb, payment, config);
anonymous.HttpContext.User = new ClaimsPrincipal();
Check(Code(await anonymous.SyncPayment(1)) == 401,
    "payment recovery requires authenticated customer before any database or provider access");
Check(Code(await controller.SyncPayment(0)) == 400,
    "invalid recovery IDs refused before database/provider access");
foreach (var url in new string?[] { null, "", "replace-with-public-https-api-url/api/checkout/webhook", "http://example.com/api/checkout/webhook",
    "https://localhost:5076/api/checkout/webhook", "https://127.0.0.1/api/checkout/webhook", "https://api.localhost/api/checkout/webhook" })
{
    var missingUrl = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["MercadoPago:WebhookSecret"] = secret, ["Store:WebhookUrl"] = url }).Build();
    Check(Code(await Controller(offlineDb, payment, missingUrl).CreateFinalOrder(new CreateOrderRequest {
        Items = [new() { IdProduct = 1, Quantity = 1 }] })) == 503, "invalid/missing webhook URL blocks checkout before database or preference");
}
Check(PaymentUrls.IsValidWebhook("https://example.com/api/checkout/webhook"), "public HTTPS webhook URL accepted");
Check(payment.Preferences == 0, "invalid URL configuration never creates a preference");
Check(Code(await controller.ReceiveWebhook(null)) == 400, "null body rejected");
Check(Code(await controller.ReceiveWebhook(new WebhookPayload())) == 400, "missing action rejected");
Check(Code(await controller.ReceiveWebhook(new WebhookPayload { Action = "merchant_order.updated" })) == 200,
    "unhandled event ignored without effects");

foreach (var header in new[] { "x-signature", "x-request-id" })
{
    Sign(controller); controller.Request.Headers.Remove(header);
    Check(Code(await controller.ReceiveWebhook(payload)) == 401, "missing " + header);
}
Sign(controller); controller.Request.QueryString = QueryString.Empty;
Check(Code(await controller.ReceiveWebhook(payload)) == 401, "missing signed query ID");
Sign(controller); controller.Request.QueryString = new("?data.id=123&data.id=123");
Check(Code(await controller.ReceiveWebhook(payload)) == 401, "ambiguous query ID");
Sign(controller); controller.Request.Headers.Append("x-signature", "ts=1,v1=invalid");
Check(Code(await controller.ReceiveWebhook(payload)) == 401, "ambiguous signature");
Sign(controller); controller.Request.Headers["x-signature"] = "ts=1,v1=invalid";
Check(Code(await controller.ReceiveWebhook(payload)) == 401, "invalid signature");
Sign(controller, signingSecret: "wrong-secret");
Check(Code(await controller.ReceiveWebhook(payload)) == 401, "wrong signing key");
Sign(controller); controller.Request.QueryString = new("?data.id=124");
Check(Code(await controller.ReceiveWebhook(Payload("124"))) == 401, "query ID tampering invalidates signature");
Sign(controller);
Check(Code(await controller.ReceiveWebhook(Payload("124"))) == 400, "body ID must match signed query ID");
Check(Code(await controller.ReceiveWebhook(new WebhookPayload { Action = "payment.updated" })) == 400, "missing body data rejected");
foreach (var id in new[] { "", "0", "-1", "abc", "9223372036854775808" })
{
    Sign(controller, id);
    Check(Code(await controller.ReceiveWebhook(Payload(id))) is 400 or 401, "invalid payment ID rejected: " + id);
}
Check(payment.Lookups == 0, "invalid notifications never contact provider or database");
Sign(controller);
Check(Code(await controller.ReceiveWebhook(payload)) == 200 && payment.Lookups == 1, "valid independently generated HMAC reaches authenticated lookup");
payment.Result = payment.Result with { Id = 124 };
Check(Code(await controller.ReceiveWebhook(payload)) == 502, "provider must return requested payment ID");
payment.Result = payment.Result with { Id = 123, Status = null };
Check(Code(await controller.ReceiveWebhook(payload)) == 502, "provider must return payment status");
foreach (var error in new Exception[] { new HttpRequestException(), new TaskCanceledException(),
    new MercadoPagoException("SDK failure", new Exception()), new MercadoPagoApiException("API failure", null!) })
{
    payment.Failure = error;
    Check(Code(await controller.ReceiveWebhook(payload)) == 503, "provider error allows retry: " + error.GetType().Name);
}
payment.Failure = null;

// Exercise the installed SDK's real serialization and request building without a network.
var originalHttp = MercadoPagoConfig.HttpClient;
var originalToken = MercadoPagoConfig.AccessToken;
var sdkHttp = new FakeSdkHttp();
try
{
    MercadoPagoConfig.HttpClient = sdkHttp;
    MercadoPagoConfig.AccessToken = "security-checks-only";
    var service = new MercadoPagoService(config);
    var searchOrder = new Order { IdOrder = 10, MercadoPagoPreferenceId = "test-preference" };
    Check(await service.FindPaymentIdForOrderAsync(searchOrder) == 88,
        "SDK recovery searches saved preference, filters order reference, and prefers approved over later failed attempts");
    Check(sdkHttp.Urls.Single().Contains("preference_id=test-preference"), "SDK sends preference filter to provider");
    Check(new Uri(sdkHttp.Urls.Single()).Query.Contains("limit=50"), "SDK respects Mercado Pago's maximum search page size of 50");
    var mapped = await service.VerifyPaymentStatusAsync(88);
    Check(mapped == new VerifiedPayment(88, "approved", "10", 123.45m, "ARS", new DateTime(2026, 10, 14, 3, 30, 0, DateTimeKind.Utc)),
        "SDK maps trusted approval timestamp to UTC alongside ID/reference/base amount/currency");
    sdkHttp.SearchBody = """{"elements":[],"total":0,"next_offset":0}""";
    Check(await service.FindPaymentIdForOrderAsync(searchOrder) is null, "SDK empty preference search has no payment");
    var beforeRequests = sdkHttp.Urls.Count;
    Check(await service.FindPaymentIdForOrderAsync(new Order { IdOrder = 10 }) is null && sdkHttp.Urls.Count == beforeRequests,
        "SDK recovery without saved preference never searches unrelated payments");
}
finally
{
    MercadoPagoConfig.HttpClient = originalHttp;
    MercadoPagoConfig.AccessToken = originalToken;
}

if (args.Contains("--database"))
{
    // Only the connection is read. Access tokens and webhook secrets are never used or printed.
    var apiPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../PaymentGateway.API"));
    var local = new ConfigurationBuilder().SetBasePath(apiPath)
        .AddJsonFile("appsettings.Development.json", optional: true).AddEnvironmentVariables().Build();
    var connection = local.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Configure ConnectionStrings__DefaultConnection for integration checks.");
    var builder = new NpgsqlConnectionStringBuilder(connection) { Database = "postgres" };
    await using var admin = new NpgsqlConnection(builder.ConnectionString);
    await admin.OpenAsync();
    var database = "webhook_validation_" + Guid.NewGuid().ToString("N");
    await using (var create = new NpgsqlCommand($"CREATE DATABASE \"{database}\"", admin))
        await create.ExecuteNonQueryAsync();
    try
    {
        builder.Database = database;
        await using var db = new PaymentDbContext(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options);
        await db.Database.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>()
            .MigrateAsync("20261015210342_PurchaseConfirmationEmails");
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "PRODUCTS" ("ProductName", "UnitPrice", "Stock", "Type")
            VALUES ('Security check', 123.45, 1, 'PHYSICAL');
            """);
        await db.Database.MigrateAsync();
        Check(await db.ProductPriceHistory.AnyAsync(h => h.Reason == "INITIAL_SNAPSHOT" && h.UnitPrice == 123.45m),
            "upgrading an existing database seeds observed prices without inventing historical timestamps");
        var customer = new Customer { Email = "security-check@example.invalid" };
        var product = await db.Products.SingleAsync();
        db.Customers.Add(customer); await db.SaveChangesAsync();
        var order = new Order { IdCustomer = customer.IdCustomer, TotalAmount = 123.45m, Status = "PENDING_PAYMENT",
            MercadoPagoPreferenceId = "test-preference", Items = [new OrderItem { IdProduct = product.IdProduct,
                ProductName = product.ProductName, ProductType = "PHYSICAL", Quantity = 1, FinalPrice = 123.45m }] };
        db.Orders.Add(order); await db.SaveChangesAsync();
        payment = new FakePayment { Result = new(123, "approved", order.IdOrder.ToString(CultureInfo.InvariantCulture), 123.45m, "ARS") };
        controller = Controller(db, payment, config); Sign(controller);
        var verified = payment.Result;
        foreach (var mismatch in new[] { verified with { Amount = 123.44m }, verified with { Amount = 123.46m },
            verified with { Amount = null }, verified with { Currency = "USD" }, verified with { Currency = null },
            verified with { Currency = "ars" }, verified with { Status = "rejected", Amount = 1m } })
        {
            payment.Result = mismatch;
            Check(Code(await controller.ReceiveWebhook(payload)) == 409, "amount/currency mismatch refused");
            Check((await db.Orders.AsNoTracking().SingleAsync()).Status == "PENDING_PAYMENT" &&
                (await db.Products.AsNoTracking().SingleAsync()).Stock == 1, "mismatch leaves persisted order and stock unchanged");
        }
        payment.Result = verified;
        order.MercadoPagoPreferenceId = null; await db.SaveChangesAsync();
        Check(Code(await controller.ReceiveWebhook(payload)) == 409, "order without provider preference refused");
        order.MercadoPagoPreferenceId = "test-preference"; await db.SaveChangesAsync();
        payment.Result = verified with { Status = "pending" };
        Check(Code(await controller.ReceiveWebhook(payload)) == 200 && order.Status == "PAYMENT_PROCESSING", "pending provider payment cannot approve order");
        payment.Result = verified with { Status = "rejected" };
        await controller.ReceiveWebhook(payload); await controller.ReceiveWebhook(payload);
        Check(order.Status == "REJECTED" && product.Stock == 2 && (await db.Products.AsNoTracking().SingleAsync()).Stock == 2,
            "duplicate rejection restores reserved stock exactly once");
        payment.Result = verified;
        await controller.ReceiveWebhook(payload); await controller.ReceiveWebhook(payload);
        Check(order.Status == "APPROVED" && product.Stock == 1 && (await db.Products.AsNoTracking().SingleAsync()).Stock == 1,
            "late approval reacquires stock exactly once across retries");
        Check(order.ConfirmationEmailPending, "verified approval durably queues the purchase email");
        var emailSender = new FakeEmail { Fail = true };
        var emailServices = new ServiceCollection();
        emailServices.AddDbContext<PaymentDbContext>(options => options.UseNpgsql(builder.ConnectionString));
        emailServices.AddSingleton<IEmailService>(emailSender);
        using var emailProvider = emailServices.BuildServiceProvider();
        var emailWorker = new PurchaseEmailService(emailProvider.GetRequiredService<IServiceScopeFactory>(), NullLogger<PurchaseEmailService>.Instance);
        await emailWorker.SendPendingAsync();
        await db.Entry(order).ReloadAsync();
        Check(order.ConfirmationEmailPending && order.ConfirmationEmailSentAt is null && order.Status == "APPROVED",
            "SMTP failure leaves confirmed payment intact and email available for retry");
        emailSender.Fail = false;
        await emailWorker.SendPendingAsync();
        await db.Entry(order).ReloadAsync();
        Check(!order.ConfirmationEmailPending && order.ConfirmationEmailSentAt is not null && emailSender.Deliveries == 1 &&
            emailSender.Recipient == customer.Email, "purchase confirmation is delivered to the order customer and marked sent");
        await controller.ReceiveWebhook(payload);
        await emailWorker.SendPendingAsync();
        Check(emailSender.Deliveries == 1, "duplicate approved webhook and worker retry do not resend confirmation");
        payment.Result = verified with { Amount = 1m };
        Check(Code(await controller.ReceiveWebhook(payload)) == 409, "already approved order still validates payment amount");
        order.Status = "REJECTED"; product.Stock = 0; await db.SaveChangesAsync(); payment.Result = verified;
        await controller.ReceiveWebhook(payload);
        Check(order.Status == "PAID_REQUIRES_REVIEW" && product.Stock == 0, "late paid order without stock requires manual review");
        payment.Result = verified with { ExternalReference = int.MaxValue.ToString(CultureInfo.InvariantCulture) };
        Check(Code(await controller.ReceiveWebhook(payload)) == 404, "unknown order never created by webhook");

        // Use persisted state across each call, just as separate HTTP requests do.
        db.ChangeTracker.Clear();
        var stored = await db.Orders.SingleAsync();
        stored.Status = "PENDING_PAYMENT";
        (await db.Products.SingleAsync()).Stock = 1;
        await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        controller = Controller(db, payment, Configuration(null));
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", customer.IdCustomer.ToString())], "security-check"));
        var beforeLookups = payment.Lookups;
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", int.MaxValue.ToString())], "security-check"));
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 404 && payment.Lookups == beforeLookups,
            "another customer cannot trigger payment verification for this order");
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", customer.IdCustomer.ToString())], "security-check"));
        Check(Code(await controller.SyncPayment(int.MaxValue)) == 404,
            "nonexistent recovery order refused");
        payment.Result = verified with { ExternalReference = (order.IdOrder + 1).ToString() };
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 409,
            "payment from another order cannot approve the requested order");
        payment.Result = verified with { ExternalReference = null };
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 409,
            "unreferenced payment cannot approve requested order");
        payment.Result = verified with { Amount = 1 };
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 409 &&
            (await db.Orders.AsNoTracking().SingleAsync()).Status == "PENDING_PAYMENT",
            "browser recovery cannot bypass amount/currency verification");
        db.ChangeTracker.Clear(); payment.Result = verified;
        payment.FoundPaymentId = null;
        beforeLookups = payment.Lookups;
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 204 && payment.Lookups == beforeLookups &&
            (await db.Orders.AsNoTracking().SingleAsync()).Status == "PENDING_PAYMENT", "preference with no payment stays pending");
        payment.Failure = new HttpRequestException();
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 503 &&
            (await db.Orders.AsNoTracking().SingleAsync()).Status == "PENDING_PAYMENT", "search outage cannot approve order");
        payment.Failure = null; payment.FoundPaymentId = 123;
        payment.Result = verified with { Status = "pending" };
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 204 &&
            (await db.Orders.AsNoTracking().SingleAsync()).Status == "PAYMENT_PROCESSING", "recovery without return ID queries preference and does not trust browser approval");
        db.ChangeTracker.Clear(); payment.Result = verified;
        Check(Code(await controller.SyncPayment(order.IdOrder)) == 204 &&
            (await db.Orders.AsNoTracking().SingleAsync()).Status == "APPROVED", "lost/invalid webhook recovered from provider without disabling signature validation");
        db.ChangeTracker.Clear(); beforeLookups = payment.Lookups;
        await controller.SyncPayment(order.IdOrder);
        Check(payment.Lookups == beforeLookups && (await db.Products.AsNoTracking().SingleAsync()).Stock == 1,
            "repeated recovery is idempotent and does not requery approved payment or deduct stock twice");
        await AdminOrderChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options, customer.IdCustomer, Check);
        await BackgroundPaymentChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options,
            customer.IdCustomer, Check);
        await CouponOfferChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options, customer.IdCustomer, Check);
        await PurchaseReceiptChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options, customer.IdCustomer, Check);
        await StatisticsChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options, customer.IdCustomer, Check);
        await DashboardOverviewChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options, customer.IdCustomer, Check);
        await TagManagementChecks.RunAsync(new DbContextOptionsBuilder<PaymentDbContext>().UseNpgsql(builder.ConnectionString).Options, Check);
    }
    finally
    {
        NpgsqlConnection.ClearAllPools();
        await using var drop = new NpgsqlCommand($"DROP DATABASE \"{database}\" WITH (FORCE)", admin);
        await drop.ExecuteNonQueryAsync();
        Console.WriteLine("Temporary webhook validation database removed.");
    }
}
Console.WriteLine($"PASS: {checks} security checks; no real payments performed.");

void Check(bool condition, string description)
{
    if (!condition) throw new InvalidOperationException("FAIL: " + description);
    checks++; Console.WriteLine("PASS: " + description);
}
static IConfiguration Configuration(string? value) => new ConfigurationBuilder().AddInMemoryCollection(
    new Dictionary<string, string?> { ["MercadoPago:WebhookSecret"] = value }).Build();
static WebhookPayload Payload(string id = "123") => new() { Action = "payment.updated", Data = new WebhookData { Id = id } };
static int Code(IActionResult result) => result switch
{
    StatusCodeResult status => status.StatusCode,
    ObjectResult body => body.StatusCode ?? 200,
    _ => throw new InvalidOperationException("Unexpected result: " + result.GetType().Name)
};
static CheckoutController Controller(PaymentDbContext db, FakePayment payment, IConfiguration configuration) =>
    new(new OrderRepository(db), payment, db, configuration, NullLogger<CheckoutController>.Instance,
        new PaymentReconciliationService(new OrderRepository(db), payment, db, NullLogger<PaymentReconciliationService>.Instance))
    { ControllerContext = new() { HttpContext = new DefaultHttpContext {
        User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("idCustomer", "1")], "security-check")) } } };
static void Sign(CheckoutController controller, string id = "123", string signingSecret = secret)
{
    const string requestId = "independent-security-check";
    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
    var manifest = $"id:{id};request-id:{requestId};ts:{timestamp};";
    var signature = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingSecret), Encoding.UTF8.GetBytes(manifest)));
    controller.Request.QueryString = new("?data.id=" + Uri.EscapeDataString(id));
    controller.Request.Headers["x-request-id"] = requestId;
    controller.Request.Headers["x-signature"] = $"ts={timestamp},v1={signature}";
}
sealed class FakeEmail : IEmailService
{
    public bool Fail { get; set; }
    public int Deliveries { get; private set; }
    public string? Recipient { get; private set; }
    public Task SendPinEmailAsync(string toEmail, string pin) => throw new InvalidOperationException("No PIN expected.");
    public Task SendPurchaseConfirmationAsync(string toEmail, Order order)
    {
        if (Fail) throw new InvalidOperationException("Simulated SMTP failure.");
        Deliveries++; Recipient = toEmail;
        return Task.CompletedTask;
    }
}

sealed class FakePayment : IPaymentService
{
    public long? FoundPaymentId { get; set; } = 123;
    public int Searches { get; private set; }
    public Task<long?> FindPaymentIdForOrderAsync(Order order)
    {
        Searches++;
        return Failure is null ? Task.FromResult(FoundPaymentId) : Task.FromException<long?>(Failure);
    }
    public VerifiedPayment Result { get; set; } = new(123, "approved", null, 123.45m, "ARS");
    public Exception? Failure { get; set; }
    public int Lookups { get; private set; }
    public int Preferences { get; private set; }
    public Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId)
    {
        Lookups++;
        return Failure is null ? Task.FromResult(Result) : Task.FromException<VerifiedPayment>(Failure);
    }
    public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order)
    {
        Preferences++;
        throw new InvalidOperationException("These checks must not create preferences.");
    }
}

sealed class FakeSdkHttp : MercadoPago.Http.IHttpClient
{
    public List<string> Urls { get; } = [];
    public string SearchBody { get; set; } = """
        {"elements":[
          {"preference_id":"other-preference","external_reference":"10","payments":[{"id":999,"status":"approved"}]},
          {"preference_id":"test-preference","external_reference":"other-order","payments":[{"id":998,"status":"approved"}]},
          {"preference_id":"test-preference","external_reference":"10","payments":[
            {"id":88,"status":"approved","last_modified":"2026-10-14T00:00:00Z"},
            {"id":89,"status":"pending","last_modified":"2026-10-15T00:00:00Z"},
            {"id":90,"status":"rejected","last_modified":"2026-10-16T00:00:00Z"}]}],"total":3,"next_offset":3}
        """;
    public Task<MercadoPagoResponse> SendAsync(MercadoPagoRequest request, IRetryStrategy retryStrategy,
        CancellationToken cancellationToken = default)
    {
        var url = request.Url.ToString(); Urls.Add(url);
        if (url.Contains("/merchant_orders/search"))
        {
            var limit = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(new Uri(url).Query)["limit"];
            if (!int.TryParse(limit, out var pageSize) || pageSize <= 0 || pageSize > 50)
                return Task.FromResult(new MercadoPagoResponse(400, new Dictionary<string, string>(),
                    """{"message":"Limit cannot be greater than 50 for searches.","error":"invalid_limit","status":400}"""));
        }
        var json = url.Contains("/merchant_orders/search") ? SearchBody : """
            {"id":88,"status":"approved","external_reference":"10","transaction_amount":123.45,"currency_id":"ARS",
            "date_approved":"2026-10-14T00:30:00.000-03:00",
            "transaction_details":{"net_received_amount":100,"total_paid_amount":150}}
            """;
        return Task.FromResult(new MercadoPagoResponse(200, new Dictionary<string, string>(), json));
    }
}
