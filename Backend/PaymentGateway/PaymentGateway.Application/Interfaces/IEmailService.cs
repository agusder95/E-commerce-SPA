using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.Interfaces;

public interface IEmailService
{
    Task SendPinEmailAsync(string toEmail, string pin);
    Task SendPurchaseConfirmationAsync(string toEmail, Order order);
}
