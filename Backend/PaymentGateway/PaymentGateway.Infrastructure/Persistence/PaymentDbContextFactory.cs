using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PaymentGateway.Infrastructure.Persistence;

// Allows migrations without starting SMTP, Redis or Mercado Pago services.
public sealed class PaymentDbContextFactory : IDesignTimeDbContextFactory<PaymentDbContext>
{
    public PaymentDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=Order_Customer;Username=paymentgateway";
        var options = new DbContextOptionsBuilder<PaymentDbContext>()
            .UseNpgsql(connection)
            .Options;
        return new PaymentDbContext(options);
    }
}
