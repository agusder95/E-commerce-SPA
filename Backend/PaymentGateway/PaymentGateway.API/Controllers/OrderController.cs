using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.API.Controllers;

//Atributos
[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IOrderRepository _orderRepository;

    public OrderController(IOrderRepository orderService)
    {
        _orderRepository = orderService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        //Mapeo DTO
        var newOrder = new Order
        {
            IdCustomer = request.IdCustomer,
            DatePurchase = DateTime.UtcNow,
            Status = "Pending",
            SubTotal = request.Items.Sum(i => i.UnitPrice * i.Quantity),
            TotalAmount = request.Items.Sum(i => i.UnitPrice * i.Quantity),
            Items = request
                .Items.Select(i => new OrderItem
                {
                    IdProduct = i.IdProduct,
                    ProductName = i.ProductName,
                    OriginalUnitPrice = i.UnitPrice,
                    FinalPrice = i.UnitPrice,
                    Quantity = i.Quantity,
                })
                .ToList(),
        };

        var createdOrder = await _orderRepository.CreateOrderAsync(newOrder);

        return Created(
            $"/api/Order/{createdOrder.IdOrder}",
            new { OrderId = createdOrder.IdOrder }
        );
        /*return CreatedAtRoute(
            "GetOrder",
            new { id = CreatedOrder.IdOrder },
            new { OrderId = CreatedOrder.IdOrder }
        );
        */
    }

    [HttpGet("{idOrder}", Name = "GetOrder")]
    public async Task<IActionResult> GetOrder(int idOrder)
    {
        var order = await _orderRepository.GetOrderByIdAsync(idOrder);

        if (order == null)
            return NotFound();

        return Ok(
            new
            {
                order.IdOrder,
                order.IdCustomer,
                order.TotalAmount,
                order.Status,
                order.DatePurchase,
                order.MercadoPagoPreferenceId,
                Items = order.Items.Select(i => new
                {
                    i.ProductName,
                    i.OriginalUnitPrice,
                    i.FinalPrice,
                    i.Quantity,
                }),
            }
        );
    }
}
