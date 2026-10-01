using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.Interfaces;

public interface ICustomerRepository
{
    Task<Customer?> GetCustomerByEmailAsync(string email);
    Task<Customer> CreateCustomerAsync(Customer customer);
}
