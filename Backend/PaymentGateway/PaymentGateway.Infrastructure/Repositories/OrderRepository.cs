using Microsoft.EntityFrameworkCore;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly PaymentDbContext _context;

    //Inyeccion DbContext
    public OrderRepository(PaymentDbContext context)
    {
        _context = context;
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
            .Orders.Where(o =>
                (o.Status == "Pending" || o.Status == "PENDING_PAYMENT")
                && o.DatePurchase < cutoff
            )
            .ToListAsync();
    }

    public async Task CancelOrdersAsync(IEnumerable<Order> orders)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        foreach (var order in orders)
        {
            await _context.Entry(order).ReloadAsync();
            if (order.Status != "Pending" && order.Status != "PENDING_PAYMENT") continue;
            await _context.Entry(order).Collection(o => o.Items).LoadAsync();
            foreach (var item in order.Items.Where(i => i.ProductType == "PHYSICAL"))
            {
                var product = await _context.Products.FindAsync(item.IdProduct);
                if (product is not null) product.Stock += item.Quantity;
            }
            order.Status = "CANCELLED";
            _context.Orders.Update(order);
        }
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
    }
}
