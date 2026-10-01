using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;

    public OrderService(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<IEnumerable<PurchaseResponseDTO>> GetCustomerPurchasesAsync(int customerId)
    {
        var orders = await _orderRepository.GetApprovedOrdersByCustomerIdAsync(customerId);

        return orders.Select(o => new PurchaseResponseDTO
        {
            OrderId = o.IdOrder,
            CreatedAt = o.DatePurchase,
            Status = o.Status,
            MercadoPagoPreferenceId = o.MercadoPagoPreferenceId,
            Items = o
                .Items.Select(item => new PurchasedItemDTO
                {
                    ProductName = item.ProductName,
                    DownloadUrl =
                        $"https://api.tu-reserva.com/downloads/{item.IdOrderItem}?token=temp",
                })
                .ToList(),
        });
    }

    public async Task<IEnumerable<PurchaseResponseDTO>> GetCustomerNonApprovedPurchasesAsync(int customerId)
    {
        var orders = await _orderRepository.GetNonApprovedOrdersByCustomerIdAsync(customerId);

        return orders.Select(o => new PurchaseResponseDTO
        {
            OrderId = o.IdOrder,
            CreatedAt = o.DatePurchase,
            Status = o.Status,
            MercadoPagoPreferenceId = o.MercadoPagoPreferenceId,
            Items = o
                .Items.Select(item => new PurchasedItemDTO
                {
                    ProductName = item.ProductName,
                    DownloadUrl =
                        $"https://api.tu-reserva.com/downloads/{item.IdOrderItem}?token=temp",
                })
                .ToList(),
        });
    }
}
