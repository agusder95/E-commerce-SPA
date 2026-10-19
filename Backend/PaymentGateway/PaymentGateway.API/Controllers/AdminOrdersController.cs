using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/admin/orders"), Authorize(Roles = "ADMIN,Admin,admin")]
public class AdminOrdersController(PaymentDbContext db) : ControllerBase
{
    [HttpPost("{id:int}/cancel")]
    public Task<IActionResult> Cancel(int id) => ChangeStatus(id, restore: false);

    [HttpPost("{id:int}/restore")]
    public Task<IActionResult> Restore(int id) => ChangeStatus(id, restore: true);

    private static bool ReservesStock(string status) => status is "Pending" or "PENDING_PAYMENT" or "PAYMENT_PROCESSING" or "APPROVED";

    private async Task<IActionResult> ChangeStatus(int id, bool restore)
    {
        try { return await UpdateOrder(id, restore); }
        catch (Exception exception) when (exception is PostgresException { SqlState: "40001" or "40P01" } ||
            exception is DbUpdateException { InnerException: PostgresException { SqlState: "40001" or "40P01" } })
        {
            return Conflict(new { Message = "La orden o su stock cambiaron mientras la actualizabas. Revisá el estado actual y volvé a intentar." });
        }
    }

    private async Task<IActionResult> UpdateOrder(int id, bool restore)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var orders = await db.Orders.FromSqlInterpolated($"""
            SELECT * FROM "ORDERS" WHERE "Id_order" = {id} FOR UPDATE
            """).ToListAsync();
        var order = orders.SingleOrDefault();
        if (order is null) return NotFound(new { Message = "No encontramos esta orden." });
        if (restore && order.Status != "CANCELLED")
            return Conflict(new { Message = "Solo se pueden restaurar órdenes canceladas. Actualizá la lista para ver su estado actual." });
        if (!restore && order.Status == "CANCELLED")
            return Conflict(new { Message = "Esta orden ya está cancelada." });
        var next = restore ? order.PreviousStatus ?? "PENDING_PAYMENT" : "CANCELLED";
        await db.Entry(order).Collection(o => o.Items).LoadAsync();
        if (ReservesStock(order.Status) != ReservesStock(next))
        {
            var physical = order.Items.Where(i => i.ProductType == "PHYSICAL").GroupBy(i => i.IdProduct)
                .Select(g => new { Id = g.Key, Quantity = g.Sum(i => i.Quantity) }).OrderBy(i => i.Id).ToList();
            foreach (var item in physical)
            {
                var products = await db.Products.FromSqlInterpolated($"""
                    SELECT * FROM "PRODUCTS" WHERE "Id_Product" = {item.Id} FOR UPDATE
                    """).ToListAsync();
                var product = products.SingleOrDefault();
                if (restore && (product is null || product.IsDeleted || product.Stock < item.Quantity))
                    return Conflict(new { Message = "No hay stock suficiente para restaurar esta orden. Revisá la disponibilidad de los productos." });
                if (product is not null) product.Stock += restore ? -item.Quantity : item.Quantity;
            }
        }
        if (!restore) order.PreviousStatus = order.Status;
        order.Status = next;
        order.ManuallyCancelled = !restore;
        if (restore) order.PreviousStatus = null;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { Message = restore ? "Orden restaurada correctamente." : "Orden cancelada correctamente." });
    }
}
