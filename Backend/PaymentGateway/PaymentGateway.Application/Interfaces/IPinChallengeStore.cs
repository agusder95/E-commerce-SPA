using PaymentGateway.Application.DTOs;

namespace PaymentGateway.Application.Interfaces;

public interface IPinChallengeStore
{
    Task<PinAttemptResult> TryIssueAsync(string subject, string client, string challengeId, string proof);
    Task<string?> GetChallengeIdAsync(string subject);
    Task<PinAttemptResult> TryConsumeAsync(string subject, string client, string? challengeId, string proof);
    Task RevokeAsync(string subject, string challengeId);
}
