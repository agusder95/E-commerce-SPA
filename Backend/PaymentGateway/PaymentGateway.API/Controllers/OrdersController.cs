using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly PaymentDbContext _db;
    private readonly IAssetStorage _storage;

    public OrdersController(IOrderService orderService, PaymentDbContext db, IAssetStorage storage)
    {
        _orderService = orderService;
        _db = db;
        _storage = storage;
    }

    [HttpGet("items/{id:int}/download")]
    public async Task<IActionResult> Download(int id, [FromQuery] int file = 0)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out var customerId)) return Unauthorized();
        var item = await _db.OrderItems.AsNoTracking().FirstOrDefaultAsync(i => i.IdOrderItem == id &&
            i.Order!.IdCustomer == customerId && i.Order.Status == "APPROVED" && i.ProductType == "DIGITAL");
        if (item is null) return NotFound();
        var files = DigitalFileCollection.Read(item.DigitalFiles, item.DigitalFileKey);
        if (file < 0 || file >= files.Count) return NotFound();
        return Ok(new { Url = _storage.CreateDownloadUrl(files[file].Key), files[file].Name });
    }

    [HttpGet("my-purchases")]
    public async Task<IActionResult> GetMyPurchases()
    {
        var customerIdClaim = User.FindFirst("idCustomer")?.Value;

        if (
            string.IsNullOrEmpty(customerIdClaim)
            || !int.TryParse(customerIdClaim, out int customerId)
        )
        {
            return Unauthorized("El token no contiene una identificación de cliente válida.");
        }

        var purchases = await _orderService.GetCustomerPurchasesAsync(customerId);

        return Ok(purchases);
    }

    [HttpGet("my-purchases-pending")]
    public async Task<IActionResult> GetMyPendingPurchases()
    {
        var customerIdClaim = User.FindFirst("idCustomer")?.Value;

        if (
            string.IsNullOrEmpty(customerIdClaim)
            || !int.TryParse(customerIdClaim, out int customerId)
        )
        {
            return Unauthorized("El token no contiene una identificación de cliente válida.");
        }

        var purchases = await _orderService.GetCustomerNonApprovedPurchasesAsync(customerId);

        return Ok(purchases);
    }
}
