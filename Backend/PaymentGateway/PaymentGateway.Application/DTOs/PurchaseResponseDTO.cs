namespace PaymentGateway.Application.DTOs;

public class PurchaseResponseDTO
{
    public int OrderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = null!;
    public string? MercadoPagoPreferenceId { get; set; }
    public List<PurchasedItemDTO> Items { get; set; } = new();
}

public class PurchasedItemDTO
{
    public string ProductName { get; set; }

    public string DownloadUrl { get; set; }
}
