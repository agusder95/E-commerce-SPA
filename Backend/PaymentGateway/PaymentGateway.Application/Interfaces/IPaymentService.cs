using PaymentGateway.Application.DTOs;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.Interfaces;

public interface IPaymentService
{
    // Recibe nuestra entidad Order de dominio y devuelve el DTO con los datos de cobro
    // que se utilizarán para crear la preferencia de pago en Mercado Pago.
    Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order);

    // Consulta estado real y referencia de orden
    Task<(string Status, string ExternalReference)> VerifyPaymentStatusAsync(long paymentId);
}
