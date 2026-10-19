using Microsoft.EntityFrameworkCore;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class PurchaseReceiptChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var product = new Product { ProductName = "Current catalog name", Type = "DIGITAL", UnitPrice = 9999 };
        db.Products.Add(product); await db.SaveChangesAsync();
        var order = new Order { IdCustomer = customerId, Status = "APPROVED", SubTotal = 400, TotalAmount = 270, CouponCodeUsed = "AHORRO",
            Items = [new() { IdProduct = product.IdProduct, ProductName = "Purchased digital name", ProductType = "DIGITAL", Quantity = 1,
                OriginalUnitPrice = 100, FinalPrice = 90, DigitalFileKey = "products/receipt/manual.pdf" },
                new() { IdProduct = product.IdProduct, ProductName = "Purchased physical name", ProductType = "PHYSICAL", Quantity = 2,
                    OriginalUnitPrice = 150, FinalPrice = 90 }] };
        db.Orders.Add(order); await db.SaveChangesAsync();
        var service = new OrderService(new OrderRepository(db));
        var receipt = (await service.GetCustomerPurchasesAsync(customerId)).Single(p => p.OrderId == order.IdOrder);
        check(receipt.Subtotal == 400 && receipt.TotalAmount == 270 && receipt.DiscountAmount == 130 && receipt.CouponCodeUsed == "AHORRO",
            "purchase receipt exposes stored subtotal, discounts, coupon and total");
        check(receipt.Items[0].ProductName == "Purchased digital name" && receipt.Items[0].OriginalUnitPrice == 100 &&
            receipt.Items[1].Quantity == 2 && receipt.Items[1].FinalUnitPrice == 90 && receipt.Items[1].LineTotal == 180,
            "purchase receipt uses historical product snapshots and quantities instead of current catalog");
        check(receipt.Items[0].Files.Count == 1 && receipt.Items[0].DownloadUrl is not null && receipt.Items[1].DownloadUrl is null,
            "approved purchase provides download metadata only for its digital items");
        check(!(await service.GetCustomerPurchasesAsync(int.MaxValue)).Any(p => p.OrderId == order.IdOrder),
            "purchase receipt never exposes another customer's purchase");
        order.Status = "CANCELLED"; await db.SaveChangesAsync();
        var cancelled = (await service.GetCustomerNonApprovedPurchasesAsync(customerId)).Single(p => p.OrderId == order.IdOrder);
        check(cancelled.TotalAmount == 270 && cancelled.Items[1].LineTotal == 180 && cancelled.Items.All(i => i.DownloadUrl is null && i.Files.Count == 0),
            "cancelled purchases retain complete receipt but expose no downloads");
    }
}
