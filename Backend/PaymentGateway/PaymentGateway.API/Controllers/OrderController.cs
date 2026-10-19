using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/order"), Authorize]
public class OrderController(IOrderRepository orders) : ControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out var customerId)) return Unauthorized();
        var order = await orders.GetOrderByIdAsync(id);
        if (order is null || order.IdCustomer != customerId) return NotFound();
        return Ok(new { order.IdOrder, order.Status, order.TotalAmount, order.DatePurchase, order.MercadoPagoPreferenceId });
    }
}
