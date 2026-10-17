namespace PaymentGateway.Domain.Entities;

public class ProductPriceHistory
{
    public long Id { get; set; }
    public int IdProduct { get; set; }
    public DateTime RecordedAt { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? DiscountPrice { get; set; }
    public DateTime? DiscountEndDate { get; set; }
    // INITIAL_SNAPSHOT marks an existing price first observed during migration.
    public string Reason { get; set; } = "PRICE_CHANGE";
    public Product Product { get; set; } = null!;
}
