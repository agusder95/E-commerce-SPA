using System.Globalization;
using System.Text;
using System.Text.Json;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.DTOs;

public static class CouponRules
{
    public static bool IsValid(Coupon? coupon, DateTime utcNow) => coupon is { IsActive: true, Discount: > 0 and < 100 } &&
        (coupon.ExpirationDate is null || coupon.ExpirationDate > utcNow);

    public static decimal ProductPrice(Product product, DateTime utcNow) => HasActiveOffer(product, utcNow)
        ? product.DiscountPrice.GetValueOrDefault() : product.UnitPrice;

    public static int ApplyToItems(Coupon coupon, IEnumerable<OrderItem> items, IReadOnlyCollection<Product> products, DateTime utcNow)
    {
        var eligible = items.Where(item => CanDiscount(coupon, products.Single(p => p.IdProduct == item.IdProduct), utcNow)).ToList();
        foreach (var item in eligible) item.FinalPrice = decimal.Round(item.FinalPrice * (1 - coupon.Discount / 100), 2);
        return eligible.Count;
    }

    public static bool HasActiveOffer(Product product, DateTime utcNow) =>
        product.DiscountPrice is > 0 && product.DiscountPrice < product.UnitPrice &&
        (product.DiscountEndDate is null || product.DiscountEndDate > utcNow);

    public static bool CanDiscount(Coupon coupon, Product product, DateTime utcNow) =>
        AppliesTo(coupon, product) && (coupon.Cumulative || !HasActiveOffer(product, utcNow));

    public static string NormalizeCode(string value) => string.Concat(value.Trim().Normalize(NormalizationForm.FormD)
        .Where(character => CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark))
        .Normalize(NormalizationForm.FormC).ToUpperInvariant();

    public static List<string> ReadTags(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(json)?.Where(tag => !string.IsNullOrWhiteSpace(tag)).ToList() ?? []; }
        catch (JsonException) { return []; }
    }

    public static bool AppliesTo(Coupon coupon, Product product)
    {
        if (!string.IsNullOrEmpty(coupon.ProductType) && coupon.ProductType != product.Type) return false;
        var requiredTags = ReadTags(coupon.Tags);
        if (requiredTags.Count == 0) return true;
        var productTags = ReadTags(product.Tags).Select(TagNames.Key).ToHashSet();
        return requiredTags.Any(tag => productTags.Contains(TagNames.Key(tag)));
    }
}
