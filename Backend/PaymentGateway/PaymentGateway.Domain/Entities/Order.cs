using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PaymentGateway.Domain.Entities;

public class Order
{
    [Key]
    [Column("Id_order")]
    public int IdOrder { get; set; }

    [Column("Id_customer")]
    public int IdCustomer { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal SubTotal { get; set; }

    [MaxLength(50)]
    public string? CouponCodeUsed { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal GlobalDiscount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "Pending";

    public DateTime DatePurchase { get; set; } = DateTime.UtcNow;

    [MaxLength(255)]
    public string? MercadoPagoPreferenceId { get; set; }

    // Propiedades de navegación
    public Customer? Customer { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
