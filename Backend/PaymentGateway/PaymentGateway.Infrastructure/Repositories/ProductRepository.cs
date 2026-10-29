using Microsoft.EntityFrameworkCore;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly PaymentDbContext _context;

    public ProductRepository(PaymentDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Product>> GetAllActiveAsync()
    {
        return await _context
            .Products.Where(p => !p.IsDeleted)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<Product?> GetByIdAsync(int id)
    {
        return await _context.Products.FirstOrDefaultAsync(p => p.IdProduct == id && !p.IsDeleted);
    }
}
