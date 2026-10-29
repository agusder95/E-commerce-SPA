namespace PaymentGateway.Application.DTOs;

public sealed record DashboardProduct(int Id, string Name, string? Type, DateTime CreatedAt, bool IsDeleted,
    long Quantity, int AvailableDays, decimal UnitsPerDay);
