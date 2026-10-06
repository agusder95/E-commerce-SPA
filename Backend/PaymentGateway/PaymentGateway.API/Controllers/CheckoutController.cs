using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CheckoutController : ControllerBase
{
    //Agrego interfaz cache y correo

    private readonly IOrderRepository _orderRepository;
    private readonly IPaymentService _paymentService;

    //Inyeccion
    public CheckoutController(IOrderRepository orderRepository, IPaymentService paymentService)
    {
        _orderRepository = orderRepository;
        _paymentService = paymentService;
    }

    [HttpPost("create-order")]
    public async Task<IActionResult> CreateFinalOrder([FromBody] CreateOrderRequest request)
    {
        // 1.  Entidad base en estado pendiente
        var newOrder = new Order
        {
            IdCustomer = request.IdCustomer,
            DatePurchase = DateTime.UtcNow,
            Status = "PENDING_PAYMENT",
            SubTotal = request.Items.Sum(i => i.UnitPrice * i.Quantity),
            TotalAmount = request.Items.Sum(i => i.UnitPrice * i.Quantity),
            Items = request
                .Items.Select(item => new OrderItem
                {
                    IdProduct = item.IdProduct,
                    ProductName = item.ProductName,
                    Quantity = item.Quantity,
                    OriginalUnitPrice = item.UnitPrice,
                    FinalPrice = item.UnitPrice,
                })
                .ToList(),
        };

        // 2. Guarda en PostgreSQL
        var createdOrder = await _orderRepository.CreateOrderAsync(newOrder);

        // 3. Genera Preferencia en Mercado Pago
        var mpResponse = await _paymentService.CreatePreferenceAsync(createdOrder);

        // 4. Guarda ID de Mercado Pago en DB
        createdOrder.MercadoPagoPreferenceId = mpResponse.PreferenceId;
        await _orderRepository.UpdateOrderAsync(createdOrder);

        // 5. URL oficial de pago al frontend en React
        return Ok(
            new
            {
                Message = "Orden creada y vinculada con Mercado Pago exitosamente.",
                OrderId = createdOrder.IdOrder,
                PreferenceId = mpResponse.PreferenceId,
                InitPointUrl = mpResponse.InitPoint, // <--  Frontend usara esta URL para redirigir
            }
        );
    }

    [AllowAnonymous] // Excepcion seguridad Mercado Pago
    [HttpPost("webhook")]
    public async Task<IActionResult> ReceiveWebhook([FromBody] WebhookPayload payload)
    {
        // Filtro eventos irrelevantes
        if (payload.Action != "payment.created" && payload.Action != "payment.updated")
        {
            return Ok(); // MP exige siempre un 200 OK rapido
        }

        // Conversion ID pago a numero
        if (!long.TryParse(payload.Data.Id, out long paymentId))
        {
            return BadRequest("ID de pago inválido.");
        }

        // Verificacion segura contra servidores MP
        var (status, externalReference) = await _paymentService.VerifyPaymentStatusAsync(paymentId);

        // Conversion ID orden a numero
        if (!int.TryParse(externalReference, out int orderId))
        {
            return Ok(); // Si no hay referencia nuestra, ignoramos
        }

        // Recuperacion orden en base de datos
        var order = await _orderRepository.GetOrderByIdAsync(orderId);
        if (order == null)
        {
            return NotFound("Orden no encontrada.");
        }

        // Actualizacion estado segun respuesta de MP
        if (status == "approved")
        {
            order.Status = "APPROVED";
            // AQUI en el futuro: Enviar email con link de descarga
        }
        else if (status == "rejected" || status == "cancelled")
        {
            order.Status = "REJECTED";
        }

        // Persistencia nuevo estado
        await _orderRepository.UpdateOrderAsync(order);

        // Confirmacion de recepcion a MP
        return Ok();
    }
}
