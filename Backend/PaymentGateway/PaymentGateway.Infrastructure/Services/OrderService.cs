using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Services;

public class OrderService(IOrderRepository orderRepository) : IOrderService
{
    public async Task<IEnumerable<PurchaseResponseDTO>> GetCustomerPurchasesAsync(int customerId) =>
        (await orderRepository.GetApprovedOrdersByCustomerIdAsync(customerId)).Select(o => MapPurchase(o, allowDownloads: true));

    public async Task<IEnumerable<PurchaseResponseDTO>> GetCustomerNonApprovedPurchasesAsync(int customerId) =>
        (await orderRepository.GetNonApprovedOrdersByCustomerIdAsync(customerId)).Select(o => MapPurchase(o, allowDownloads: false));

    private static PurchaseResponseDTO MapPurchase(Order order, bool allowDownloads)
    {
        // Receipts always use the purchase snapshots, never today's catalog prices.
        var subtotal = order.SubTotal > 0 ? order.SubTotal : order.Items.Sum(i =>
            (i.OriginalUnitPrice > 0 ? i.OriginalUnitPrice : i.FinalPrice) * i.Quantity);
        return new PurchaseResponseDTO
        {
            OrderId = order.IdOrder, CreatedAt = order.DatePurchase, Status = order.Status,
            MercadoPagoPreferenceId = order.MercadoPagoPreferenceId,
            Subtotal = subtotal, DiscountAmount = Math.Max(0, subtotal - order.TotalAmount),
            TotalAmount = order.TotalAmount, CouponCodeUsed = order.CouponCodeUsed,
            Items = order.Items.OrderBy(item => item.IdOrderItem).Select(item =>
            {
                var files = allowDownloads && item.ProductType == "DIGITAL"
                    ? DigitalFileCollection.Read(item.DigitalFiles, item.DigitalFileKey) : [];
                return new PurchasedItemDTO
                {
                    ProductName = item.ProductName, OrderItemId = item.IdOrderItem, ProductType = item.ProductType,
                    Quantity = item.Quantity,
                    OriginalUnitPrice = item.OriginalUnitPrice > 0 ? item.OriginalUnitPrice : item.FinalPrice,
                    FinalUnitPrice = item.FinalPrice, LineTotal = item.FinalPrice * item.Quantity,
                    Files = files.Select((file, index) => new PurchasedFileDTO { Index = index, Name = file.Name }).ToList(),
                    DownloadUrl = files.Count > 0 ? $"/api/orders/items/{item.IdOrderItem}/download" : null,
                };
            }).ToList(),
        };
    }
}
