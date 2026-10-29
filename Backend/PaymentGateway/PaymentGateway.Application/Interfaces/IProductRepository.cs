using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.Interfaces;

public interface IProductRepository
{
    Task<IEnumerable<Product>> GetAllActiveAsync();
    Task<Product?> GetByIdAsync(int id);
}
