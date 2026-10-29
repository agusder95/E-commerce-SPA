using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class SaveProductRequest
{
    [Required, MaxLength(150)] public string ProductName { get; set; } = "";
    [Range(0.01, 999999999)] public decimal UnitPrice { get; set; }
    [Range(0, int.MaxValue)] public int Stock { get; set; }
    [Required, RegularExpression("^(DIGITAL|PHYSICAL|BOTH)$")] public string Type { get; set; } = "DIGITAL";
    [Range(0.01, 999999999)] public decimal? DigitalUnitPrice { get; set; }
    [MaxLength(200000)] public string Description { get; set; } = "";
    [MaxLength(255)] public string? Thumbnail { get; set; }
    [MaxLength(500)] public string? DigitalFileKey { get; set; }
    [Required, MaxLength(50)] public List<PaymentGateway.Domain.Entities.DigitalFile> DigitalFiles { get; set; } = [];
    public List<int> TagIds { get; set; } = [];
    public List<string> Gallery { get; set; } = [];
    [Range(0.01, 999999999)] public decimal? DiscountPrice { get; set; }
    public DateTime? DiscountEndDate { get; set; }
}
