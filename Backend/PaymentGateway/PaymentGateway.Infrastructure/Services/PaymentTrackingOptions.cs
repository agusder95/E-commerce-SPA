using System.ComponentModel.DataAnnotations;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentTrackingOptions
{
    public const string Section = "PaymentTracking";
    [Range(1, 1440)] public int ReservationMinutes { get; set; } = 20;
    [Range(1, 168)] public int RecoveryHours { get; set; } = 24;
    [Range(1, 1000)] public int BatchSize { get; set; } = 50;
    // Minimum retries for due/locked work or failures; empty queues have no polling timer.
    [Range(1, 300)] public int WorkerIntervalSeconds { get; set; } = 15;
    [Range(1, 300)] public int CleanupIntervalSeconds { get; set; } = 30;
    [Range(1, 3600)] public int InitialCheckSeconds { get; set; } = 30;
    [Range(1, 3600)] public int MaximumCheckSeconds { get; set; } = 300;
    [Range(2, 6000)] public int ProviderRequestsPerMinute { get; set; } = 60;
    [Range(1, 6000)] public int BackgroundRequestsPerMinute { get; set; } = 30;
    [Range(1, 100)] public int ProviderBurst { get; set; } = 4;

    public DateTime TrackingDeadline(Order order) =>
        (order.ExpiresAt ?? order.DatePurchase.AddMinutes(ReservationMinutes)).AddHours(RecoveryHours);

    public static bool IsUnresolved(Order order) => order.Status is
        "Pending" or "PENDING_PAYMENT" or "PAYMENT_PROCESSING" or "REJECTED" or "CANCELLED";

    public static bool IsAwaitingPayment(Order order) => order.Status is "Pending" or "PENDING_PAYMENT";

    public TimeSpan Delay(int attempts, bool failed = false)
    {
        var seconds = InitialCheckSeconds * Math.Pow(2, Math.Min(Math.Max(0, attempts - 1), 10));
        if (failed) seconds *= 2;
        return TimeSpan.FromSeconds(Math.Min(seconds, MaximumCheckSeconds));
    }
}
