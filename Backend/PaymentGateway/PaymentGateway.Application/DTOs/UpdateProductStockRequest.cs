using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class UpdateProductStockRequest
{
    [Required, MinLength(1), MaxLength(500)]
    public List<ProductStockUpdate> Items { get; set; } = [];
}

public class ProductStockUpdate
{
    [Range(1, int.MaxValue)] public int IdProduct { get; set; }
    [Required, Range(0, int.MaxValue)] public int? ExpectedStock { get; set; }
    [Required, Range(0, int.MaxValue)] public int? Stock { get; set; }
}
