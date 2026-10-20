using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/admin/products"), Authorize(Roles = "ADMIN,Admin,admin")]
public class AdminStockController(PaymentDbContext db) : ControllerBase
{
    [HttpPatch("stock")]
    public async Task<IActionResult> UpdateStock(UpdateProductStockRequest request, CancellationToken ct)
    {
        if (request.Items is null || request.Items.Count is < 1 or > 500 ||
            request.Items.Any(item => item is null || item.IdProduct <= 0 || item.ExpectedStock is null or < 0 || item.Stock is null or < 0) ||
            request.Items.Select(item => item.IdProduct).Distinct().Count() != request.Items.Count)
            return BadRequest(new { Message = "Indicá entre 1 y 500 productos distintos y cantidades de stock válidas." });

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        foreach (var item in request.Items.OrderBy(item => item.IdProduct))
        {
            // Compare and update atomically: a concurrent reservation must never be overwritten.
            var changed = await db.Products.Where(product => product.IdProduct == item.IdProduct &&
                product.Type == "PHYSICAL" && !product.IsDeleted && product.Stock == item.ExpectedStock)
                .ExecuteUpdateAsync(update => update.SetProperty(product => product.Stock, item.Stock!.Value), ct);
            if (changed != 1)
                return Conflict(new { Message = "El stock o la disponibilidad de un producto cambió. No se guardó ningún ajuste. Actualizá la lista y volvé a intentarlo." });
        }
        await transaction.CommitAsync(ct);
        return NoContent();
    }
}
