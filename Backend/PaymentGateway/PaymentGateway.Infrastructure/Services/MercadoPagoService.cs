using MercadoPago.Client.Payment;
using MercadoPago.Client.Preference;
using MercadoPago.Resource.Payment;
using MercadoPago.Resource.Preference;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Services;

public class MercadoPagoService : IPaymentService
{
    public async Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order)
    {
        // 1. Traducimos nuestros OrderItems al formato de Mercado Pago
        var items = order
            .Items.Select(item => new PreferenceItemRequest
            {
                Title = item.ProductName,
                Quantity = item.Quantity,
                CurrencyId = "ARS",
                UnitPrice = item.FinalPrice,
            })
            .ToList();

        // 2. Armamos la petición de la Preferencia
        var request = new PreferenceRequest
        {
            Items = items,

            // Asegúrate de que BackUrls esté DENTRO de las llaves de PreferenceRequest
            BackUrls = new PreferenceBackUrlsRequest
            {
                Success = "http://localhost:5173/checkout/result?status=approved",
                Failure = "http://localhost:5173/checkout/result?status=failure",
                Pending = "http://localhost:5173/checkout/result?status=pending",
            },

            ExternalReference = order.IdOrder.ToString(),
            // Configuracion destino Webhook
            NotificationUrl = "https://say-brewing-duress.ngrok-free.dev/api/checkout/webhook",
        };

        // 3. Usamos el cliente oficial del SDK para crear la preferencia en los servidores de MP
        var client = new PreferenceClient();
        Preference preference = await client.CreateAsync(request);

        // 4. Retornamos solo lo que a nuestro negocio y frontend le importa
        return new PaymentPreferenceResponse
        {
            PreferenceId = preference.Id,
            InitPoint = preference.InitPoint,
        };
    }

    public async Task<(string Status, string ExternalReference)> VerifyPaymentStatusAsync(
        long paymentId
    )
    {
        // Instanciacion cliente pagos MP
        var client = new PaymentClient();

        // Obtencion datos oficiales desde MP
        Payment payment = await client.GetAsync(paymentId);

        // Retorno estado pago y ID de orden interno
        return (payment.Status, payment.ExternalReference);
    }
}
