using PaymentGateway.Application.DTOs;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.Interfaces;

public interface IPaymentService
{
    // Recibe nuestra entidad Order de dominio y devuelve el DTO con los datos de cobro
    // que se utilizarán para crear la preferencia de pago en Mercado Pago.
    Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order);

    // Consulta los datos oficiales; nunca toma estado, importe o moneda del webhook/frontend.
    Task<VerifiedPayment> VerifyPaymentStatusAsync(long paymentId);

    // Recupera intentos sólo de la preferencia guardada de esta orden.
    Task<long?> FindPaymentIdForOrderAsync(Order order);
}
