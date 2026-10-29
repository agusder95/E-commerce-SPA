namespace PaymentGateway.Domain.Entities;

public class DailySale
{
    public int IdDailySale { get; set; }
    public DateOnly SaleDate { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public int OrderCount { get; set; }
}
