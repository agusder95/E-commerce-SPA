namespace PaymentGateway.Application.DTOs;

public static class PaymentUrls
{
    public static bool IsValidWebhook(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme == Uri.UriSchemeHttps && !uri.IsLoopback && !uri.Host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase) &&
        string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Fragment);
}
