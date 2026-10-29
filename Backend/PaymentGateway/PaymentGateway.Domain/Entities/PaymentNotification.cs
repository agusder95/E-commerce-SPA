namespace PaymentGateway.Domain.Entities;

public sealed class PaymentNotification
{
    public long PaymentId { get; set; }
    public long Version { get; set; }
    public long ProcessedVersion { get; set; }
    public DateTime FirstReceivedAt { get; set; }
    public DateTime LastReceivedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public int Attempts { get; set; }
}

public sealed class PaymentNotificationEvent
{
    public string EventKey { get; set; } = "";
    public long PaymentId { get; set; }
    public DateTime ReceivedAt { get; set; }
}
