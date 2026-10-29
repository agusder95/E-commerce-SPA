using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

internal static class ProductStockChecks
{
    public static async Task ValidateAsync(PaymentDbContext db, Action<bool, string> check)
    {
        var controller = new AdminStockController(db);
        foreach (var request in new[] {
            new UpdateProductStockRequest(),
            new UpdateProductStockRequest { Items = [new() { IdProduct = 1, Stock = 2 }] },
            new UpdateProductStockRequest { Items = [new() { IdProduct = 1, ExpectedStock = 1, Stock = -1 }] },
            new UpdateProductStockRequest { Items = [new() { IdProduct = 1, ExpectedStock = 1, Stock = 2 }, new() { IdProduct = 1, ExpectedStock = 1, Stock = 3 }] },
            new UpdateProductStockRequest { Items = Enumerable.Range(1, 501).Select(id => new ProductStockUpdate { IdProduct = id, ExpectedStock = 1, Stock = 2 }).ToList() }
        }) check(await controller.UpdateStock(request, default) is BadRequestObjectResult, "invalid stock batch rejected before database access");
    }

    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var first = new Product { ProductName = "Stock test A", Type = "PHYSICAL", UnitPrice = 100, Stock = 3, Tags = "[\"Aves\"]", Description = "Preserve", DiscountPrice = 80 };
        var second = new Product { ProductName = "Stock test B", Type = "PHYSICAL", UnitPrice = 200, Stock = 7 };
        var digital = new Product { ProductName = "Stock digital", Type = "DIGITAL", UnitPrice = 50 };
        var deleted = new Product { ProductName = "Stock deleted", Type = "PHYSICAL", UnitPrice = 100, Stock = 2, IsDeleted = true };
        db.Products.AddRange(first, second, digital, deleted); await db.SaveChangesAsync();
        var controller = new AdminStockController(db);
        async Task<int> Stock(int id) => await db.Products.AsNoTracking().Where(p => p.IdProduct == id).Select(p => p.Stock).SingleAsync();
        var batch = new UpdateProductStockRequest { Items = [new() { IdProduct = first.IdProduct, ExpectedStock = 3, Stock = 5 }, new() { IdProduct = second.IdProduct, ExpectedStock = 7, Stock = 0 }] };
        check(await controller.UpdateStock(batch, default) is NoContentResult && await Stock(first.IdProduct) == 5 && await Stock(second.IdProduct) == 0,
            "stock-only batch updates physical stock including zero");
        var stored = await db.Products.AsNoTracking().SingleAsync(p => p.IdProduct == first.IdProduct);
        check(stored.UnitPrice == 100 && stored.DiscountPrice == 80 && stored.Tags == "[\"Aves\"]" && stored.Description == "Preserve",
            "stock batch preserves prices, offers, descriptions and tags");
        check(await controller.UpdateStock(batch, default) is ConflictObjectResult && await Stock(first.IdProduct) == 5,
            "replayed stock batch cannot apply twice");
        var conflict = new UpdateProductStockRequest { Items = [new() { IdProduct = first.IdProduct, ExpectedStock = 5, Stock = 6 }, new() { IdProduct = second.IdProduct, ExpectedStock = 7, Stock = 8 }] };
        check(await controller.UpdateStock(conflict, default) is ConflictObjectResult && await Stock(first.IdProduct) == 5,
            "a stale stock entry rolls back the entire batch");
        foreach (var product in new[] { digital, deleted })
            check(await controller.UpdateStock(new() { Items = [new() { IdProduct = product.IdProduct, ExpectedStock = product.Stock, Stock = 10 }] }, default) is ConflictObjectResult,
                "stock updates cannot alter digital or deleted products");
        await using var other = new PaymentDbContext(options);
        await other.Products.Where(p => p.IdProduct == first.IdProduct).ExecuteUpdateAsync(update => update.SetProperty(p => p.Stock, 4));
        check(await controller.UpdateStock(new() { Items = [new() { IdProduct = first.IdProduct, ExpectedStock = 5, Stock = 6 }] }, default) is ConflictObjectResult && await Stock(first.IdProduct) == 4,
            "stock update preserves a concurrent stock reservation");
        check(await controller.UpdateStock(new() { Items = [new() { IdProduct = first.IdProduct, ExpectedStock = 4, Stock = int.MaxValue }] }, default) is NoContentResult,
            "stock update accepts the maximum integer stock");
    }
}
