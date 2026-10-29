using Microsoft.EntityFrameworkCore;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Infrastructure.Services;
using Microsoft.Extensions.Options;

namespace PaymentGateway.Infrastructure.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly PaymentDbContext _context;
    private readonly PaymentTrackingOptions _tracking;

    //Inyeccion DbContext
    public OrderRepository(PaymentDbContext context, IOptions<PaymentTrackingOptions>? tracking = null)
    {
        _context = context;
        _tracking = tracking?.Value ?? new PaymentTrackingOptions();
    }

    public async Task<Order> CreateOrderAsync(Order order)
    {
        await _context.Orders.AddAsync(order); //Agregar cambios a memoria EF
        await _context.SaveChangesAsync(); //Impacto de cambios reales en la base de datos
        return order;
    }

    public async Task<Order?> GetOrderByIdAsync(int id)
    {
        return await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.IdOrder == id);
    }

    public async Task UpdateOrderAsync(Order order)
    {
        _context.Orders.Update(order);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<Order>> GetApprovedOrdersByCustomerIdAsync(int customerId)
    {
        return await _context
            .Orders.Include(o => o.Items)
            .Where(o => o.IdCustomer == customerId && o.Status == "APPROVED")
            .OrderByDescending(o => o.DatePurchase)
            .ToListAsync();
    }

    public async Task<IEnumerable<Order>> GetNonApprovedOrdersByCustomerIdAsync(int customerId)
    {
        return await _context
            .Orders.Include(o => o.Items)
            .Where(o => o.IdCustomer == customerId && o.Status != "APPROVED")
            .OrderByDescending(o => o.DatePurchase)
            .ToListAsync();
    }

    public async Task<List<Order>> GetStalePendingOrdersAsync(DateTime cutoff)
    {
        return await _context
            .Orders.AsNoTracking().Where(o =>
                (o.Status == "Pending" || o.Status == "PENDING_PAYMENT")
                && (o.ExpiresAt != null ? o.ExpiresAt <= cutoff : o.DatePurchase.AddMinutes(_tracking.ReservationMinutes) <= cutoff)
                && (o.MercadoPagoPreferenceId == null || o.MercadoPagoPreferenceId == "" || o.NextPaymentCheckAt <= cutoff)
            )
            .OrderBy(o => o.ExpiresAt).ThenBy(o => o.IdOrder).Take(_tracking.BatchSize)
            .ToListAsync();
    }

    public async Task CancelOrdersAsync(IEnumerable<Order> orders)
    {
        foreach (var candidate in orders)
        {
            await using var orderLock = await PaymentOrderLock.TryAcquireAsync(_context, candidate.IdOrder);
            if (orderLock is null) continue;
            await using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var order = await _context.Orders.SingleOrDefaultAsync(o => o.IdOrder == candidate.IdOrder);
            if (order is null) continue;
            await _context.Entry(order).ReloadAsync();
            if (order.Status != "Pending" && order.Status != "PENDING_PAYMENT") continue;
            if ((order.ExpiresAt ?? order.DatePurchase.AddMinutes(_tracking.ReservationMinutes)) > DateTime.UtcNow) continue;
            await _context.Entry(order).Collection(o => o.Items).LoadAsync();
            foreach (var item in order.Items.Where(i => i.ProductType == "PHYSICAL"))
            {
                var product = await _context.Products.FindAsync(item.IdProduct);
                if (product is not null) product.Stock += item.Quantity;
            }
            order.Status = "CANCELLED";
            var now = DateTime.UtcNow;
            order.NextPaymentCheckAt = _tracking.TrackingDeadline(order) > now
                ? now.AddSeconds(_tracking.MaximumCheckSeconds) : null;
            _context.Orders.Update(order);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
    }
}
