using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class CreateOrderRequest
{
    [MaxLength(50, ErrorMessage = "Ingresá un único código de cupón de hasta 50 caracteres.")]
    public string? CouponCode { get; set; }
    [Required(ErrorMessage = "El carrito es obligatorio."), MinLength(1, ErrorMessage = "El carrito está vacío.")]
    public List<CreateOrderItemRequest> Items { get; set; } = new();
}

public class CreateOrderItemRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Seleccioná un producto válido.")]
    public int IdProduct { get; set; }
    [Range(1, 1000, ErrorMessage = "La cantidad debe estar entre 1 y 1000.")]
    public int Quantity { get; set; }
}
