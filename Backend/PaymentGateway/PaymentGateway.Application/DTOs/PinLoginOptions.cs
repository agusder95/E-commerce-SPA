using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public sealed class PinLoginOptions
{
    public const string Section = "PinLogin";
    [Range(1, 900)] public int LifetimeSeconds { get; set; } = 300;
    [Range(1, 900)] public int ResendSeconds { get; set; } = 60;
    [Range(1, 10)] public int MaxFailedAttempts { get; set; } = 5;
    [Range(1, 3600)] public int LockoutSeconds { get; set; } = 900;
    [Range(1, 3600)] public int WindowSeconds { get; set; } = 900;
    [Range(1, 100)] public int MaxRequestsPerEmail { get; set; } = 5;
    [Range(1, 1000)] public int MaxRequestsPerIp { get; set; } = 20;
    [Range(1, 1000)] public int MaxVerificationsPerEmail { get; set; } = 20;
    [Range(1, 10000)] public int MaxVerificationsPerIp { get; set; } = 100;
    [Required, MaxLength(150)] public string RedisKeyPrefix { get; set; } = "PaymentGateway:PinLogin:";
}

public enum PinAttemptStatus { Issued, Verified, Invalid, Throttled }
public sealed record PinAttemptResult(PinAttemptStatus Status, int RetryAfterSeconds = 0);
