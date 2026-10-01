using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
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
