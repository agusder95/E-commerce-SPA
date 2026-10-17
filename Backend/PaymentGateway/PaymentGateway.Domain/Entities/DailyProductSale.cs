namespace PaymentGateway.Domain.Entities;

public class DailyProductSale
{
    public int IdDailyProductSale { get; set; }
    public DateOnly SaleDate { get; set; }
    public int IdProduct { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public Product? Product { get; set; }
}
