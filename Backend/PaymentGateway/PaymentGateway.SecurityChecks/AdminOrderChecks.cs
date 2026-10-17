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

internal static class AdminOrderChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var product = new Product { ProductName = "Admin order check", Type = "PHYSICAL", UnitPrice = 100, Stock = 2 };
        db.Products.Add(product); await db.SaveChangesAsync();
        var order = new Order { IdCustomer = customerId, Status = "APPROVED", TotalAmount = 100,
            MercadoPagoPreferenceId = "admin-order-check", Items = [new() { IdProduct = product.IdProduct,
                ProductName = product.ProductName, ProductType = "PHYSICAL", Quantity = 1, FinalPrice = 100 }] };
        db.Orders.Add(order); await db.SaveChangesAsync();
        var controller = new AdminOrdersController(db);
        check(Code(await controller.Cancel(order.IdOrder)) == 200 && order.Status == "CANCELLED" &&
            order.PreviousStatus == "APPROVED" && order.ManuallyCancelled && product.Stock == 3,
            "manual cancellation preserves previous status and releases physical stock");
        check(Code(await controller.Cancel(order.IdOrder)) == 409 && product.Stock == 3,
            "duplicate manual cancellation cannot restore stock twice");
        var payments = new ApprovedPayment(order.IdOrder);
        var reconciliation = new PaymentReconciliationService(new OrderRepository(db), payments, db, NullLogger<PaymentReconciliationService>.Instance);
        await reconciliation.ReconcileAsync(123);
        check(order.Status == "CANCELLED" && product.Stock == 3, "provider approval cannot undo manual cancellation");
        check(Code(await controller.Restore(order.IdOrder)) == 200 && order.Status == "APPROVED" &&
            !order.ManuallyCancelled && order.PreviousStatus is null && product.Stock == 2,
            "manual restoration returns to previous status and reacquires physical stock");
        check(Code(await controller.Restore(order.IdOrder)) == 409 && product.Stock == 2,
            "duplicate manual restoration cannot deduct stock twice");
        await controller.Cancel(order.IdOrder);
        product.Stock = 0; await db.SaveChangesAsync();
        check(Code(await controller.Restore(order.IdOrder)) == 409 &&
            (await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == order.IdOrder)).Status == "CANCELLED" &&
            (await db.Products.AsNoTracking().SingleAsync(p => p.IdProduct == product.IdProduct)).Stock == 0,
            "insufficient stock blocks restoration without changing persisted order or stock");
        product.Stock = 3; await db.SaveChangesAsync(); await controller.Restore(order.IdOrder);
        order.Status = "PENDING_PAYMENT"; await db.SaveChangesAsync();
        await controller.Cancel(order.IdOrder);
        await reconciliation.ReconcileAsync(123);
        check(order.Status == "CANCELLED" && order.PreviousStatus == "PAID_REQUIRES_REVIEW" && product.Stock == 3,
            "late payment keeps manual cancellation and records availability review for restoration");
        await controller.Restore(order.IdOrder);
        check(order.Status == "PAID_REQUIRES_REVIEW" && product.Stock == 3,
            "restoring a late paid cancelled order requires review without reserving unavailable stock");
        await controller.Cancel(order.IdOrder);
        check(product.Stock == 3, "cancelling an availability-review order does not release unreserved stock");
        check(Code(await controller.Cancel(int.MaxValue)) == 404, "unknown admin order returns not found");
    }

    private static int Code(IActionResult result) => result switch { ObjectResult value => value.StatusCode ?? 200,
        StatusCodeResult value => value.StatusCode, _ => throw new InvalidOperationException("Unexpected admin result") };

    private sealed class ApprovedPayment(int orderId) : IPaymentService
    {
        public Task<long?> FindPaymentIdForOrderAsync(Order order) => Task.FromResult<long?>(123);
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long id) => Task.FromResult(new VerifiedPayment(id, "approved", orderId.ToString(), 100, "ARS"));
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order) => throw new InvalidOperationException("No real preferences in admin checks");
    }
}
