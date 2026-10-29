using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Infrastructure.Services;

public sealed class ResendOptions
{
    public const string Section = "Resend";
    [Required] public string ApiKey { get; set; } = "";
    [Required, EmailAddress] public string FromEmail { get; set; } = "";
    [Required] public string FromName { get; set; } = "Juegos Fueguinos AMB";
    [EmailAddress] public string? ReplyTo { get; set; }
}
