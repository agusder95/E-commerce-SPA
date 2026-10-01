using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PaymentGateway.Domain.Entities;

public class OrderItem
{
    [Key]
    [Column("Id_order_item")]
    public int IdOrderItem { get; set; }

    [Column("Id_order")]
    public int IdOrder { get; set; }

    [Column("Id_Product")]
    public int IdProduct { get; set; }

    [Required]
    [MaxLength(255)]
    public string ProductName { get; set; } = string.Empty;

    public int Quantity { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal OriginalUnitPrice { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountApplied { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal FinalPrice { get; set; }

    // Propiedades de navegación
    public Order? Order { get; set; }
    public Product? Product { get; set; }
}
