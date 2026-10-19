namespace PaymentGateway.Application.DTOs;

public class PurchaseResponseDTO
{
    public int OrderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = null!;
    public string? MercadoPagoPreferenceId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string? CouponCodeUsed { get; set; }
    public List<PurchasedItemDTO> Items { get; set; } = new();
}

public class PurchasedItemDTO
{
    public string ProductName { get; set; } = "";
    public int OrderItemId { get; set; }
    public string? ProductType { get; set; }
    public int Quantity { get; set; }
    public decimal OriginalUnitPrice { get; set; }
    public decimal FinalUnitPrice { get; set; }
    public decimal LineTotal { get; set; }

    public string? DownloadUrl { get; set; }
    public List<PurchasedFileDTO> Files { get; set; } = [];
}

public class PurchasedFileDTO
{
    public int Index { get; set; }
    public string Name { get; set; } = "";
}
