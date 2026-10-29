namespace PaymentGateway.Domain.Entities;

public class Coupon
{
    public int IdCoupon { get; set; }
    public string Code { get; set; } = string.Empty;
    public decimal Discount { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public string? Tags { get; set; }
    public bool Cumulative { get; set; }
    public int Used { get; set; }
    public string? ProductType { get; set; }
}
