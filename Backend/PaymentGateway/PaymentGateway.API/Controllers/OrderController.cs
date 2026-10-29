using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Services;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/order"), Authorize]
public class OrderController(PaymentDbContext db, OrderWorkSignal? signal = null) : ControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, string? afterStatus = null, bool watch = false)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out var customerId)) return Unauthorized();
        Response.Headers.CacheControl = "no-store";
        var until = DateTime.UtcNow.AddSeconds(20);
        var version = signal?.Version ?? 0;
        var order = await Read();
        while (order is not null && watch && signal is not null && order.Status == afterStatus &&
            order.Status is not ("APPROVED" or "PAID_REQUIRES_REVIEW") && DateTime.UtcNow < until)
        {
            await signal.WaitAsync(version, until - DateTime.UtcNow > TimeSpan.Zero ? until - DateTime.UtcNow : TimeSpan.Zero, HttpContext.RequestAborted);
            version = signal.Version;
            order = await Read();
        }
        return order is null ? NotFound() : Ok(order);

        Task<OrderStatusView?> Read() => db.Orders.AsNoTracking().Where(o => o.IdOrder == id && o.IdCustomer == customerId)
            .Select(o => new OrderStatusView(o.IdOrder, o.Status, o.TotalAmount, o.DatePurchase, o.MercadoPagoPreferenceId, o.ExpiresAt, watch && signal != null))
            .SingleOrDefaultAsync(HttpContext.RequestAborted);
    }
    private sealed record OrderStatusView(int IdOrder, string Status, decimal TotalAmount, DateTime DatePurchase,
        string? MercadoPagoPreferenceId, DateTime? ExpiresAt, bool Live);
}
