using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class StatisticsChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var product = new Product { ProductName = "Statistics", Type = "PHYSICAL", UnitPrice = 100, Stock = 20 };
        var variant = new Product { ProductName = "Statistics", Type = "DIGITAL", UnitPrice = 100 };
        db.Products.AddRange(product, variant);
        await db.SaveChangesAsync();
        check(await db.ProductPriceHistory.CountAsync(h => h.IdProduct == product.IdProduct) == 1,
            "creating a product records its first price atomically");
        product.Stock--;
        await db.SaveChangesAsync();
        check(await db.ProductPriceHistory.CountAsync(h => h.IdProduct == product.IdProduct) == 1,
            "stock-only changes do not create price changes");
        var admin = new AdminController(db, null!);
        await admin.ProductOffers(new ProductOffersRequest { Ids = [product.IdProduct], Discount = 20,
            ExpirationDate = DateTime.UtcNow.AddDays(2) });
        check(await db.ProductPriceHistory.AnyAsync(h => h.IdProduct == product.IdProduct && h.DiscountPrice == 80),
            "bulk offers record their effective price in history");
        await admin.ProductOffers(new ProductOffersRequest { Ids = [product.IdProduct], Remove = true });
        check(await db.ProductPriceHistory.CountAsync(h => h.IdProduct == product.IdProduct) == 3,
            "removing an offer creates a price history event");

        var day = new DateTime(2025, 1, 1, 3, 0, 0, DateTimeKind.Utc);
        Order Sale(Product p, DateTime? approval, int quantity, decimal price, string status = "APPROVED") => new()
        {
            IdCustomer = customerId, DatePurchase = day.AddMonths(-1), ApprovedAt = approval, Status = status,
            TotalAmount = quantity * price, MercadoPagoPreferenceId = "statistics-test",
            Items = [new() { IdProduct = p.IdProduct, ProductName = p.ProductName, ProductType = p.Type,
                Quantity = quantity, OriginalUnitPrice = 100, BeforeCouponUnitPrice = 80, FinalPrice = price }]
        };
        var confirmed = Sale(product, null, 3, 72, "PENDING_PAYMENT");
        db.Orders.AddRange(confirmed, Sale(product, day.AddDays(1), 1, 80),
            Sale(product, day.AddTicks(-1), 50, 100), Sale(product, day.AddDays(4), 50, 100),
            Sale(product, null, 50, 100), Sale(product, day, 50, 100, "PENDING_PAYMENT"),
            Sale(product, day, 50, 100, "CANCELLED"), Sale(variant, day, 50, 100));
        await db.SaveChangesAsync();
        var repository = new OrderRepository(db);
        var provider = new ApprovedPayment(confirmed.IdOrder, day.AddHours(1));
        var reconciliation = new PaymentReconciliationService(repository, provider, db, NullLogger<PaymentReconciliationService>.Instance);
        await reconciliation.ReconcileAsync(123);
        await reconciliation.ReconcileAsync(123);
        check((await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == confirmed.IdOrder)).ApprovedAt == day.AddHours(1),
            "verified provider approval date is persisted and repeated notifications preserve it");
        var statistics = new AdminStatisticsController(db);
        var from = new DateOnly(2025, 1, 1);
        var to = new DateOnly(2025, 1, 4);
        JsonElement Json(IActionResult result) => JsonSerializer.SerializeToElement(((OkObjectResult)result).Value,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var sales = Json(await statistics.Sales(product.IdProduct, from, to));
        check(sales.GetProperty("quantity").GetInt64() == 4 && sales.GetProperty("revenue").GetDecimal() == 296 &&
            sales.GetProperty("averageUnitPrice").GetDecimal() == 74,
            "sales count approved individual-product units, final discounted revenue and quantity-weighted average");
        var periods = sales.GetProperty("periods").EnumerateArray().ToList();
        check(periods.Count == 4 && periods[0].GetProperty("quantity").GetInt64() == 3 &&
            periods[2].GetProperty("quantity").GetInt64() == 0,
            "sales use Argentina approval dates and include empty periods");
        check(sales.GetProperty("excludedOrdersWithoutApprovalDate").GetInt32() == 1,
            "legacy sales with unknown approval dates are reported separately");
        var weekly = Json(await statistics.Sales(product.IdProduct, from, to, "week"));
        var monthly = Json(await statistics.Sales(product.IdProduct, from, to, "month"));
        check(weekly.GetProperty("periods").GetArrayLength() == 1 && monthly.GetProperty("revenue").GetDecimal() == 296,
            "week and month groupings preserve period revenue");
        check(await statistics.Sales(product.IdProduct, to, from) is BadRequestObjectResult &&
            await statistics.Sales(product.IdProduct, from, to, "invalid") is BadRequestObjectResult &&
            await statistics.Prices(product.IdProduct, null, null) is BadRequestObjectResult,
            "invalid statistics filters are rejected before querying");
        db.ProductPriceHistory.AddRange(
            new() { IdProduct = product.IdProduct, RecordedAt = day, UnitPrice = 100, DiscountPrice = 80,
                DiscountEndDate = day.AddDays(1), Reason = "PRICE_CHANGE" },
            new() { IdProduct = product.IdProduct, RecordedAt = day.AddDays(2), UnitPrice = 120, Reason = "PRICE_CHANGE" });
        await db.SaveChangesAsync();
        var prices = Json(await statistics.Prices(product.IdProduct, from, to));
        var pricePeriods = prices.GetProperty("periods").EnumerateArray().ToList();
        check(pricePeriods.Select(p => p.GetProperty("effectivePrice").GetDecimal()).SequenceEqual([80m, 100m, 120m]),
            "price history includes offer, automatic expiration and subsequent list price without requiring sales");
        check(pricePeriods[1].GetProperty("reason").GetString() == "OFFER_EXPIRED" && !prices.GetProperty("hasUnknownPrices").GetBoolean(),
            "offer expiration returns to list price at the exact expiration instant");
        prices = Json(await statistics.Prices(product.IdProduct, from.AddDays(-1), to));
        check(prices.GetProperty("hasUnknownPrices").GetBoolean(), "history does not invent prices before the first observation");
        product.IsDeleted = true; await db.SaveChangesAsync();
        check(await statistics.Sales(product.IdProduct, from, to) is OkObjectResult,
            "deleted products retain queryable sales history");
    }

    private sealed class ApprovedPayment(int orderId, DateTime approvedAt) : IPaymentService
    {
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long id) =>
            Task.FromResult(new VerifiedPayment(id, "approved", orderId.ToString(), 216, "ARS", approvedAt));
        public Task<long?> FindPaymentIdForOrderAsync(Order order) => Task.FromResult<long?>(123);
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order) => throw new NotSupportedException();
    }
}
