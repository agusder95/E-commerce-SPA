using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;
using System.Globalization;
using MercadoPago.Error;
using MercadoPago.Webhook;

namespace PaymentGateway.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CheckoutController : ControllerBase
{
    //Agrego interfaz cache y correo

    private readonly IOrderRepository _orderRepository;
    private readonly IPaymentService _paymentService;
    private readonly PaymentDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<CheckoutController> _logger;
    private readonly IPaymentReconciliationService _reconciliation;

    //Inyeccion
    public CheckoutController(IOrderRepository orderRepository, IPaymentService paymentService, PaymentDbContext db,
        IConfiguration config, ILogger<CheckoutController> logger, IPaymentReconciliationService reconciliation)
    {
        _orderRepository = orderRepository;
        _paymentService = paymentService;
        _db = db;
        _config = config;
        _logger = logger;
        _reconciliation = reconciliation;
    }

    private string? WebhookSecret
    {
        get
        {
            var secret = _config["MercadoPago:WebhookSecret"];
            return string.IsNullOrWhiteSpace(secret) || secret.StartsWith("replace-with-", StringComparison.OrdinalIgnoreCase)
                ? null : secret;
        }
    }

    private ObjectResult PaymentsNotConfigured(string setting = "MercadoPago:WebhookSecret")
    {
        _logger.LogError("Falta configurar {Setting}. Los pagos permanecen bloqueados.", setting);
        var message = setting == "Store:WebhookUrl"
            ? "El servicio de pagos no está configurado: falta una URL pública HTTPS para recibir las notificaciones."
            : "El servicio de pagos no está configurado.";
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { Message = message });
    }

    private async Task<Coupon?> FindCouponAsync(string value)
    {
        var code = CouponRules.NormalizeCode(value);
        return await _db.Coupons.SingleOrDefaultAsync(c => c.Code == code && c.IsActive)
            ?? (await _db.Coupons.Where(c => c.IsActive).ToListAsync()).FirstOrDefault(c => CouponRules.NormalizeCode(c.Code) == code);
    }

    [HttpPost("validate-coupon")]
    public async Task<IActionResult> ValidateCoupon([FromBody] CreateOrderRequest request)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out _)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.CouponCode) || request.CouponCode.Length > 50)
            return BadRequest(new { Message = "Ingresá un único código de cupón válido." });
        if (request.Items.Count == 0 || request.Items.Any(i => i is null || i.IdProduct <= 0 || i.Quantity <= 0 || i.Quantity > 1000))
            return BadRequest(new { Message = "El carrito está vacío o tiene cantidades inválidas." });
        var coupon = await FindCouponAsync(request.CouponCode);
        var now = DateTime.UtcNow;
        if (!CouponRules.IsValid(coupon, now)) return BadRequest(new { Message = "El cupón no existe, está inactivo o venció." });
        var ids = request.Items.Select(i => i.IdProduct).Distinct().ToList();
        var products = await _db.Products.AsNoTracking().Where(p => ids.Contains(p.IdProduct) && !p.IsDeleted).ToListAsync();
        if (products.Count != ids.Count) return BadRequest(new { Message = "Uno de los productos ya no está disponible. Revisá el carrito." });
        var items = request.Items.GroupBy(i => i.IdProduct).Select(group => {
            var product = products.Single(p => p.IdProduct == group.Key);
            return new OrderItem { IdProduct = product.IdProduct, Quantity = group.Sum(i => i.Quantity),
                OriginalUnitPrice = product.UnitPrice, FinalPrice = CouponRules.ProductPrice(product, now) };
        }).ToList();
        var subtotal = items.Sum(i => i.OriginalUnitPrice * i.Quantity);
        var beforeCoupon = items.Sum(i => i.FinalPrice * i.Quantity);
        var scoped = products.Where(product => CouponRules.AppliesTo(coupon!, product)).ToList();
        if (scoped.Count == 0)
        {
            var type = coupon!.ProductType == "PHYSICAL" ? "productos físicos" : coupon.ProductType == "DIGITAL" ? "productos digitales" : "productos";
            var tags = CouponRules.ReadTags(coupon.Tags);
            return BadRequest(new { Message = $"Este cupón alcanza a {type}{(tags.Count > 0 ? $" con alguno de estos tags: {string.Join(", ", tags)}" : "")}. Ningún producto del carrito cumple ese alcance." });
        }
        if (CouponRules.ApplyToItems(coupon!, items, products, now) == 0)
            return BadRequest(new { Message = "El cupón no es acumulable y todos los productos que alcanza ya tienen una oferta vigente. Las ofertas se conservan." +
                (scoped.Count < products.Count ? " Los demás productos no cumplen el tipo o los tags del cupón." : "") });
        var total = items.Sum(i => i.FinalPrice * i.Quantity);
        return Ok(new { Code = CouponRules.NormalizeCode(coupon!.Code), Percentage = coupon.Discount,
            Subtotal = subtotal, ProductDiscount = subtotal - beforeCoupon, CouponDiscount = beforeCoupon - total, Total = total,
            Items = items.Select(item => {
                var product = products.Single(p => p.IdProduct == item.IdProduct);
                var before = CouponRules.ProductPrice(product, now);
                return new { item.IdProduct, item.Quantity, FinalUnitPrice = item.FinalPrice,
                    CouponDiscount = (before - item.FinalPrice) * item.Quantity,
                    CouponStatus = !CouponRules.AppliesTo(coupon, product) ? "OUT_OF_SCOPE"
                        : !coupon.Cumulative && CouponRules.HasActiveOffer(product, now) ? "OFFER_EXCLUDED" : "APPLIED" };
            }) });
    }

    [HttpPost("create-order")]
    public async Task<IActionResult> CreateFinalOrder([FromBody] CreateOrderRequest request)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out var customerId)) return Unauthorized();
        if (WebhookSecret is null) return PaymentsNotConfigured();
        if (!PaymentUrls.IsValidWebhook(_config["Store:WebhookUrl"])) return PaymentsNotConfigured("Store:WebhookUrl");
        if (request.Items.Count == 0 || request.Items.Any(i => i is null || i.Quantity <= 0 || i.Quantity > 1000))
            return BadRequest(new { Message = "El carrito está vacío o tiene cantidades inválidas." });
        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var ids = request.Items.Select(i => i.IdProduct).Distinct().ToList();
        var products = await _db.Products.Where(p => ids.Contains(p.IdProduct) && !p.IsDeleted).ToListAsync();
        var unavailableIds = ids.Except(products.Select(p => p.IdProduct))
            .Concat(products.Where(p => p.Type == "PHYSICAL" && p.Stock <= 0).Select(p => p.IdProduct)).ToList();
        if (unavailableIds.Count > 0) return BadRequest(new { Code = "PRODUCTS_UNAVAILABLE",
            Message = "Uno de los productos ya no tiene stock o dejó de estar disponible.", ProductIds = unavailableIds });
        var items = new List<OrderItem>();
        foreach (var group in request.Items.GroupBy(i => i.IdProduct))
        {
            var product = products.Single(p => p.IdProduct == group.Key);
            var quantity = group.Sum(i => i.Quantity);
            if (product.Type != "DIGITAL" && product.Type != "PHYSICAL")
                return BadRequest(new { Message = $"El producto {product.ProductName} necesita un formato válido." });
            if (product.Type == "PHYSICAL")
            {
                if (product.Stock < quantity) return BadRequest(new { Message = $"Stock insuficiente para {product.ProductName}." });
                product.Stock -= quantity;
            }
            else if (DigitalFileCollection.Read(product.DigitalFiles, product.DigitalFileKey).Count == 0)
                return BadRequest(new { Message = $"El archivo de {product.ProductName} todavía no está disponible." });
            var price = CouponRules.ProductPrice(product, DateTime.UtcNow);
            items.Add(new OrderItem { IdProduct = product.IdProduct, ProductName = product.ProductName,
                Quantity = quantity, OriginalUnitPrice = product.UnitPrice, FinalPrice = price,
                BeforeCouponUnitPrice = price, ProductDiscount = product.UnitPrice - price,
                ProductType = product.Type, DigitalFileKey = product.DigitalFileKey,
                DigitalFiles = product.Type == "DIGITAL" ? DigitalFileCollection.Write(
                    DigitalFileCollection.Read(product.DigitalFiles, product.DigitalFileKey)) : null });
        }
        Coupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            coupon = await FindCouponAsync(request.CouponCode);
            if (!CouponRules.IsValid(coupon, DateTime.UtcNow))
                return BadRequest(new { Message = "Cupón inválido, vencido o no aplicable a este carrito." });
            var scoped = items.Where(item => CouponRules.AppliesTo(coupon!, products.Single(p => p.IdProduct == item.IdProduct))).ToList();
            if (scoped.Count == 0) return BadRequest(new { Message = "El cupón no se aplica a los productos de este carrito." });
            if (CouponRules.ApplyToItems(coupon!, scoped, products, DateTime.UtcNow) > 0) coupon!.Used++;
            else coupon = null; // All scoped items have offers: continue without using the coupon.
        }
        foreach (var item in items)
            item.DiscountApplied = item.BeforeCouponUnitPrice!.Value - item.FinalPrice;
        var newOrder = new Order
        {
            IdCustomer = customerId,
            DatePurchase = DateTime.UtcNow,
            Status = "PENDING_PAYMENT",
            SubTotal = items.Sum(i => i.OriginalUnitPrice * i.Quantity),
            TotalAmount = items.Sum(i => i.FinalPrice * i.Quantity),
            CouponCodeUsed = coupon?.Code,
            Items = items,
        };
        if (newOrder.TotalAmount <= 0) return BadRequest(new { Message = "El total debe ser mayor a cero." });
        newOrder.GlobalDiscount = newOrder.SubTotal - newOrder.TotalAmount;

        // 2. Guarda en PostgreSQL
        var createdOrder = await _orderRepository.CreateOrderAsync(newOrder);

        // 3. Genera Preferencia en Mercado Pago
        var mpResponse = await _paymentService.CreatePreferenceAsync(createdOrder);

        // 4. Guarda ID de Mercado Pago en DB
        createdOrder.MercadoPagoPreferenceId = mpResponse.PreferenceId;
        await _orderRepository.UpdateOrderAsync(createdOrder);
        await transaction.CommitAsync();

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
    public async Task<IActionResult> ReceiveWebhook([FromBody] WebhookPayload? payload)
    {
        if (payload is null || string.IsNullOrWhiteSpace(payload.Action)) return BadRequest();
        // Filtro eventos irrelevantes
        if (payload.Action != "payment.created" && payload.Action != "payment.updated")
        {
            return Ok(); // Evento no procesado: no modifica órdenes ni consulta pagos.
        }

        var secret = WebhookSecret;
        if (secret is null) return PaymentsNotConfigured();
        var signedId = Request.Query["data.id"];
        var signature = Request.Headers["x-signature"];
        var requestId = Request.Headers["x-request-id"];
        if (signedId.Count != 1 || signature.Count != 1 || requestId.Count != 1 ||
            string.IsNullOrWhiteSpace(requestId[0])) return Unauthorized();
        try
        {
            WebhookSignatureValidator.Validate(signature[0], requestId[0], signedId[0], secret);
        }
        catch (InvalidWebhookSignatureException exception)
        {
            _logger.LogWarning("Webhook de pago rechazado por firma inválida ({Reason}). Verificá MercadoPago:WebhookSecret de la misma aplicación que el AccessToken.", exception.Reason);
            return Unauthorized();
        }

        // La firma autentica el ID de la query, no el cuerpo del mensaje.
        if (!string.Equals(payload.Data?.Id, signedId[0], StringComparison.Ordinal) ||
            !long.TryParse(signedId[0], NumberStyles.None, CultureInfo.InvariantCulture, out var paymentId) || paymentId <= 0)
            return BadRequest(new { Message = "ID de pago inválido." });

        return PaymentResult(await _reconciliation.ReconcileAsync(paymentId));
    }

    [HttpPost("orders/{orderId:int}/sync-payment")]
    public async Task<IActionResult> SyncPayment(int orderId)
    {
        if (!int.TryParse(User.FindFirst("idCustomer")?.Value, out var customerId)) return Unauthorized();
        if (orderId <= 0) return BadRequest();
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.IdOrder == orderId && o.IdCustomer == customerId);
        if (order is null) return NotFound();
        if (order.Status is "APPROVED" or "PAID_REQUIRES_REVIEW") return NoContent();
        // La preferencia guardada decide qué pagos consultar, nunca los IDs/estados del navegador.
        var result = await _reconciliation.ReconcileAsync(null, order);
        return result == PaymentReconciliationResult.Success ? NoContent() : PaymentResult(result);
    }

    private IActionResult PaymentResult(PaymentReconciliationResult result) => result switch
    {
        PaymentReconciliationResult.Success => Ok(),
        PaymentReconciliationResult.Unavailable => StatusCode(StatusCodes.Status503ServiceUnavailable),
        PaymentReconciliationResult.InvalidProviderResponse => StatusCode(StatusCodes.Status502BadGateway),
        PaymentReconciliationResult.NotFound => NotFound("Orden no encontrada."),
        _ => Conflict(new { Message = "El pago no coincide con la orden." })
    };
}
