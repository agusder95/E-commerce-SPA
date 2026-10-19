using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using System.Text.Json;

namespace PaymentGateway.Infrastructure.Persistence;

// Allows migrations without starting SMTP, Redis or Mercado Pago services.
public sealed class PaymentDbContextFactory : IDesignTimeDbContextFactory<PaymentDbContext>
{
    public PaymentDbContext CreateDbContext(string[] args)
    {
        var apiDirectory = new[] {
            Path.Combine(Directory.GetCurrentDirectory(), "PaymentGateway.API"),
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../PaymentGateway.API")),
            Directory.GetCurrentDirectory()
        }.FirstOrDefault(path => File.Exists(Path.Combine(path, "appsettings.json")))
            ?? throw new InvalidOperationException("Ejecutá las migraciones desde Backend/PaymentGateway.");
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        string? configuredConnection = null;
        foreach (var file in new[] { "appsettings.json", $"appsettings.{environment}.json" })
        {
            var path = Path.Combine(apiDirectory, file);
            if (!File.Exists(path)) continue;
            using var json = JsonDocument.Parse(File.ReadAllText(path));
            if (json.RootElement.TryGetProperty("ConnectionStrings", out var connections) &&
                connections.TryGetProperty("DefaultConnection", out var setting))
                configuredConnection = setting.GetString();
        }
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? configuredConnection ?? throw new InvalidOperationException("Falta configurar ConnectionStrings:DefaultConnection.");
        var options = new DbContextOptionsBuilder<PaymentDbContext>()
            .UseNpgsql(connection)
            .Options;
        return new PaymentDbContext(options);
    }
}
