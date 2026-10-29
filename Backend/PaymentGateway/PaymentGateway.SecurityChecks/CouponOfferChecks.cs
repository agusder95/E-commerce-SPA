using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Repositories;
using PaymentGateway.Infrastructure.Services;

internal static class CouponOfferChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, int customerId, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var offered = new Product { ProductName = "Coupon offer check", Type = "PHYSICAL", UnitPrice = 100, Stock = 20,
            DiscountPrice = 80, DiscountEndDate = DateTime.UtcNow.AddDays(1) };
        var regular = new Product { ProductName = "Coupon regular check", Type = "PHYSICAL", UnitPrice = 100, Stock = 20 };
        db.Products.AddRange(offered, regular); await db.SaveChangesAsync();
        // Asset storage is unused by coupon administration.
        var admin = new AdminController(db, null!);
        var request = new SaveCouponRequest { Code = "OFFER-CHECK", Discount = 10, Cumulative = true };
        check(await admin.Coupon(request) is OkObjectResult, "admin can save an accumulating coupon");
        var coupon = await db.Coupons.SingleAsync(c => c.Code == request.Code);
        check(coupon.Cumulative, "coupon accumulation option is persisted");
        request.Cumulative = false;
        await admin.UpdateCoupon(coupon.IdCoupon, request);
        check(!(await db.Coupons.AsNoTracking().SingleAsync(c => c.IdCoupon == coupon.IdCoupon)).Cumulative,
            "editing coupon can turn accumulation off");
        var payments = new TestPreferences();
        var repository = new OrderRepository(db);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["MercadoPago:WebhookSecret"] = "coupon-check-only", ["Store:WebhookUrl"] = "https://api.example/checkout/webhook" }).Build();
        var checkout = new CheckoutController(repository, payments, db, config, NullLogger<CheckoutController>.Instance,
            new PaymentReconciliationService(repository, payments, db, NullLogger<PaymentReconciliationService>.Instance))
        { ControllerContext = new() { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(
            new ClaimsIdentity([new Claim("idCustomer", customerId.ToString())], "check")) } } };
        async Task<Order> Buy(params Product[] products)
        {
            var result = await checkout.CreateFinalOrder(new CreateOrderRequest { CouponCode = coupon.Code,
                Items = products.Select(p => new CreateOrderItemRequest { IdProduct = p.IdProduct, Quantity = 1 }).ToList() });
            check(result is OkObjectResult, "coupon checkout succeeds with mocked preference");
            return payments.LastOrder!;
        }
        CreateOrderRequest CouponRequest(params Product[] products) => new() { CouponCode = coupon.Code,
            Items = products.Select(p => new CreateOrderItemRequest { IdProduct = p.IdProduct, Quantity = 1 }).ToList() };
        async Task<JsonElement> Quote(params Product[] products)
        {
            var result = await checkout.ValidateCoupon(CouponRequest(products));
            check(result is OkObjectResult, "coupon preview accepts valid single coupon");
            return JsonSerializer.SerializeToElement(((OkObjectResult)result).Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        var ordersBefore = await db.Orders.CountAsync();
        var preview = await Quote(offered, regular);
        check(preview.GetProperty("subtotal").GetDecimal() == 200 && preview.GetProperty("total").GetDecimal() == 170 &&
            preview.GetProperty("productDiscount").GetDecimal() == 20 && preview.GetProperty("couponDiscount").GetDecimal() == 10,
            "coupon preview calculates original subtotal, offer discount and coupon discount separately");
        var quotedItems = preview.GetProperty("items").EnumerateArray().ToList();
        check(quotedItems.Single(i => i.GetProperty("idProduct").GetInt32() == offered.IdProduct).GetProperty("couponStatus").GetString() == "OFFER_EXCLUDED" &&
            quotedItems.Single(i => i.GetProperty("idProduct").GetInt32() == offered.IdProduct).GetProperty("finalUnitPrice").GetDecimal() == 80 &&
            quotedItems.Single(i => i.GetProperty("idProduct").GetInt32() == regular.IdProduct).GetProperty("couponStatus").GetString() == "APPLIED" &&
            quotedItems.Single(i => i.GetProperty("idProduct").GetInt32() == regular.IdProduct).GetProperty("finalUnitPrice").GetDecimal() == 90,
            "mixed-cart quote exposes coupon only on regular item and preserves offered item price");
        check(await db.Orders.CountAsync() == ordersBefore && coupon.Used == 0 && offered.Stock == 20 && regular.Stock == 20 && payments.LastOrder is null,
            "validating coupon does not create orders, reserve stock, consume coupon or contact payment provider");
        var invalid = CouponRequest(regular); invalid.CouponCode = "INVALID";
        check(await checkout.ValidateCoupon(invalid) is BadRequestObjectResult, "unknown coupon rejected before checkout");
        invalid.CouponCode = coupon.Code + ",SECOND";
        check(await checkout.ValidateCoupon(invalid) is BadRequestObjectResult, "multiple coupon codes are not accepted as one valid coupon");
        var order = await Buy(offered, regular);
        check(order.TotalAmount == 170 && order.Items.Single(i => i.IdProduct == offered.IdProduct).FinalPrice == 80 && coupon.Used == 1,
            "non-accumulating coupon skips offered item and discounts only regular item");
        coupon.Cumulative = true; await db.SaveChangesAsync();
        preview = await Quote(offered, regular);
        order = await Buy(offered, regular);
        check(order.TotalAmount == 162 && preview.GetProperty("total").GetDecimal() == order.TotalAmount && order.Items.Single(i => i.IdProduct == offered.IdProduct).FinalPrice == 72,
            "accumulating coupon applies percentage to already discounted price");
        var offeredItem = order.Items.Single(i => i.IdProduct == offered.IdProduct);
        check(offeredItem.BeforeCouponUnitPrice == 80 && offeredItem.ProductDiscount == 20 && offeredItem.DiscountApplied == 8,
            "checkout preserves separate unit offer and coupon discounts for future statistics");
        coupon.Cumulative = false; await db.SaveChangesAsync();
        var uses = coupon.Used;
        check(await checkout.ValidateCoupon(CouponRequest(offered)) is BadRequestObjectResult,
            "coupon preview explains when non-accumulating coupon has no eligible products");
        order = await Buy(offered);
        check(order.TotalAmount == 80 && order.CouponCodeUsed is null && coupon.Used == uses,
            "all offered items are ignored without blocking payment or counting coupon usage");
        offered.DiscountEndDate = DateTime.UtcNow.AddDays(-1); await db.SaveChangesAsync();
        order = await Buy(offered);
        check(order.TotalAmount == 90 && order.CouponCodeUsed == coupon.Code,
            "expired product offer does not prevent non-accumulating coupon");
        offered.DiscountEndDate = DateTime.UtcNow.AddDays(1);
        coupon.ProductType = "PHYSICAL"; coupon.Tags = "[\"Colecciones\"]";
        offered.Tags = coupon.Tags; regular.Tags = coupon.Tags; regular.Type = "DIGITAL";
        await db.SaveChangesAsync();
        var excludedByType = await checkout.ValidateCoupon(CouponRequest(offered, regular));
        check(excludedByType is BadRequestObjectResult && JsonSerializer.Serialize(((BadRequestObjectResult)excludedByType).Value).Contains("tags"),
            "physical-only non-accumulating coupon explains why offered physical plus regular digital has no eligible items");
        coupon.ProductType = null; await db.SaveChangesAsync();
        preview = await Quote(offered, regular);
        check(preview.GetProperty("total").GetDecimal() == 170 && preview.GetProperty("couponDiscount").GetDecimal() == 10,
            "non-accumulating coupon valid for physical and digital applies only to the regular-priced product");
        offered.UnitPrice = 26543m; offered.DiscountPrice = 21234.40m; regular.UnitPrice = 8453.45m;
        await db.SaveChangesAsync();
        preview = await Quote(offered, regular);
        check(preview.GetProperty("total").GetDecimal() == 28842.50m && preview.GetProperty("couponDiscount").GetDecimal() == 845.35m &&
            preview.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("idProduct").GetInt32() == regular.IdProduct)
                .GetProperty("finalUnitPrice").GetDecimal() == 7608.10m,
            "Nueva Colec physical offer is preserved and only regular digital receives the non-accumulating 10 percent coupon");
        coupon.ProductType = "PHYSICAL";
        check(!CouponRules.CanDiscount(coupon, regular, DateTime.UtcNow), "accumulation respects coupon product-type scope");
        coupon.ProductType = null; coupon.Tags = "[\"Arte\"]"; regular.Tags = "[\"Ciencia\"]";
        check(!CouponRules.CanDiscount(coupon, regular, DateTime.UtcNow), "accumulation respects coupon tag scope");
    }

    private sealed class TestPreferences : IPaymentService
    {
        public Order? LastOrder { get; private set; }
        public Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order)
        {
            LastOrder = order;
            return Task.FromResult(new PaymentPreferenceResponse { PreferenceId = "coupon-check", InitPoint = "https://example.invalid/payment" });
        }
        public Task<long?> FindPaymentIdForOrderAsync(Order order) => throw new InvalidOperationException("No provider calls");
        public Task<VerifiedPayment> VerifyPaymentStatusAsync(long id) => throw new InvalidOperationException("No provider calls");
    }
}
