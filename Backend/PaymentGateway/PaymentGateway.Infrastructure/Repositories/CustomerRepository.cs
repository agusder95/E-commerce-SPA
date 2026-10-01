using Microsoft.EntityFrameworkCore;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly PaymentDbContext _context;

    public CustomerRepository(PaymentDbContext context)
    {
        _context = context;
    }

    public async Task<Customer?> GetCustomerByEmailAsync(string email)
    {
        return await _context.Customers.FirstOrDefaultAsync(c => c.Email == email);
    }

    public async Task<Customer> CreateCustomerAsync(Customer customer)
    {
        await _context.Customers.AddAsync(customer);
        await _context.SaveChangesAsync();
        return customer; // EF asigna ID autogenerado
    }
}
