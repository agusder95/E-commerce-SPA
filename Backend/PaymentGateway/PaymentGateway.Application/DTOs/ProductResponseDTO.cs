using System.Text.Json;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.DTOs;

public class ProductResponseDTO
{
    public int IdProduct { get; set; }
    public string ProductName { get; set; } = null!;
    public decimal UnitPrice { get; set; }
    public int Stock { get; set; }
    public string? Type { get; set; }
    public string? Thumbnail { get; set; }
    public string? Description { get; set; }
    public List<string> Tags { get; set; } = new();
    public decimal? DiscountPrice { get; set; }
    public DateTime? DiscountEndDate { get; set; }
    public List<string> Gallery { get; set; } = new();
    public DateTime CreatedAt { get; set; }

    public static ProductResponseDTO FromEntity(Product product)
    {
        return new ProductResponseDTO
        {
            IdProduct = product.IdProduct,
            ProductName = product.ProductName,
            UnitPrice = product.UnitPrice,
            Stock = product.Stock,
            Type = product.Type,
            Thumbnail = product.Thumbnail,
            Description = product.Description,
            Tags = DeserializeJsonList(product.Tags),
            DiscountPrice = product.DiscountPrice,
            DiscountEndDate = product.DiscountEndDate,
            Gallery = DeserializeJsonList(product.Gallery),
            CreatedAt = product.CreatedAt,
        };
    }

    private static List<string> DeserializeJsonList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new List<string>();

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }
}
