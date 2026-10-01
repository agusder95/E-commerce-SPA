namespace PaymentGateway.Application.Interfaces;

public interface IEmailService
{
    Task SendPinEmailAsync(string toEmail, string pin);
}
