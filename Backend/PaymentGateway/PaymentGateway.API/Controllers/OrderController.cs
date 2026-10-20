using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/order"), Authorize]
public class OrderController(PaymentDbContext db) : ControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out var customerId)) return Unauthorized();
        var order = await db.Orders.AsNoTracking().Where(o => o.IdOrder == id && o.IdCustomer == customerId)
            .Select(o => new { o.IdOrder, o.Status, o.TotalAmount, o.DatePurchase, o.MercadoPagoPreferenceId, o.ExpiresAt })
            .SingleOrDefaultAsync();
        return order is null ? NotFound() : Ok(order);
    }
}
