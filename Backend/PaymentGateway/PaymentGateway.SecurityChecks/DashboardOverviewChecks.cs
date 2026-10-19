using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.API.Controllers;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

internal static class DashboardOverviewChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        // An isolated historical range avoids interference with other integration fixtures.
        var day = new DateTime(2020, 2, 1, 3, 0, 0, DateTimeKind.Utc);
        Product Product(string name, int age, bool deleted = false) => new()
        { ProductName = name, Type = "DIGITAL", UnitPrice = 100, CreatedAt = day.AddDays(age), IsDeleted = deleted };
        var old = Product("Overview old", -30);
        var recent = Product("Overview recent", 9);
        var unsold = Product("Overview unsold", 5);
        var future = Product("Overview future", 10);
        var deleted = Product("Overview deleted", -30, true);
        db.Products.AddRange(old, recent, unsold, future, deleted);
        await db.SaveChangesAsync();
        Order Sale(Product product, DateTime? approved, int quantity, string status = "APPROVED", bool cancelled = false) => new()
        {
            IdCustomer = customerId, DatePurchase = day.AddMonths(-1), ApprovedAt = approved,
            Status = status, ManuallyCancelled = cancelled, TotalAmount = quantity * 75,
            Items = [new() { IdProduct = product.IdProduct, ProductName = product.ProductName, ProductType = product.Type,
                Quantity = quantity, FinalPrice = 75, OriginalUnitPrice = 100, BeforeCouponUnitPrice = 75 }]
        };
        db.Orders.AddRange(Sale(old, day, 6), Sale(recent, day.AddDays(9), 2), Sale(deleted, day.AddDays(2), 3),
            Sale(old, day.AddTicks(-1), 100), Sale(old, day.AddDays(10), 100), Sale(old, null, 100),
            Sale(old, day, 100, "PENDING_PAYMENT"), Sale(old, day, 100, "CANCELLED"), Sale(old, day, 100, cancelled: true));
        await db.SaveChangesAsync();
        var controller = new AdminController(db, null!);
        var from = new DateOnly(2020, 2, 1);
        var to = new DateOnly(2020, 2, 10);
        JsonElement Json(IActionResult result) => JsonSerializer.SerializeToElement(((OkObjectResult)result).Value,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var summary = Json(await controller.Dashboard(from, to));
        check(summary.GetProperty("quantity").GetInt64() == 11 && summary.GetProperty("purchases").GetInt32() == 3 &&
            summary.GetProperty("sales").GetDecimal() == 825 && summary.GetProperty("average").GetDecimal() == 275,
            "overview uses approval dates in Argentina and excludes pending, cancelled, undated and out-of-range payments");
        var top = summary.GetProperty("topProducts").EnumerateArray().ToList();
        check(top.Select(p => p.GetProperty("id").GetInt32()).SequenceEqual([old.IdProduct, deleted.IdProduct, recent.IdProduct]),
            "overview top three ranks sold units and preserves sales of deleted products");
        var least = summary.GetProperty("leastSoldProducts").EnumerateArray().ToList();
        check(least.Select(p => p.GetProperty("id").GetInt32()).SequenceEqual([unsold.IdProduct, old.IdProduct, recent.IdProduct]),
            "least sold includes zero sales, excludes deleted or future products, and compares creation-adjusted rates");
        check(least[0].GetProperty("availableDays").GetInt32() == 5 && least[1].GetProperty("availableDays").GetInt32() == 10 &&
            least[2].GetProperty("availableDays").GetInt32() == 1 && least[2].GetProperty("unitsPerDay").GetDecimal() == 2,
            "overview counts only calendar days available within the inclusive date range");
        check(summary.GetProperty("excludedOrdersWithoutApprovalDate").GetInt32() >= 1,
            "overview reports historical orders without a verified approval date");
        var singleDay = Json(await controller.Dashboard(from, from));
        check(singleDay.GetProperty("quantity").GetInt64() == 6 && singleDay.GetProperty("leastSoldProducts").GetArrayLength() == 1,
            "single-day overview includes the local midnight boundary and excludes products created later");
        check(await controller.Dashboard(to, from) is BadRequestObjectResult &&
            await controller.Dashboard(from, null) is BadRequestObjectResult &&
            await controller.Dashboard(from, new DateOnly(2099, 1, 1)) is BadRequestObjectResult &&
            await controller.Dashboard(new DateOnly(2000, 1, 1), to) is BadRequestObjectResult,
            "overview rejects incomplete, reversed, future and oversized ranges");
    }
}
