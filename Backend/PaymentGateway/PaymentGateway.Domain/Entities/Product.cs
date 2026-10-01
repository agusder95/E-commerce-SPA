using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PaymentGateway.Domain.Entities;

public class Product
{
    [Key]
    [Column("Id_Product")]
    public int IdProduct { get; set; }

    [Required]
    [MaxLength(150)]
    public string ProductName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }

    public int Stock { get; set; }

    [MaxLength(50)]
    public string? Type { get; set; }

    [MaxLength(255)]
    public string? Thumbnail { get; set; }

    public string? Description { get; set; }

    // Guardamos JSON. Conversion List en los DTOs.
    public string? Tags { get; set; }
    public string? Gallery { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? DiscountPrice { get; set; }

    public DateTime? DiscountEndDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsDeleted { get; set; }

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
