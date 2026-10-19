using MercadoPago.Client.Payment;
using MercadoPago.Client;
using MercadoPago.Client.MerchantOrder;
using System.Globalization;
using MercadoPago.Client.Preference;
using MercadoPago.Resource.Payment;
using MercadoPago.Resource.Preference;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace PaymentGateway.Infrastructure.Services;

public class MercadoPagoService(IConfiguration config) : IPaymentService
{
    public async Task<long?> FindPaymentIdForOrderAsync(Order order)
    {
        if (string.IsNullOrWhiteSpace(order.MercadoPagoPreferenceId)) return null;
        var result = await new MerchantOrderClient().SearchAsync(new SearchRequest {
            Limit = 50,
            Filters = new Dictionary<string, object> { ["preference_id"] = order.MercadoPagoPreferenceId }
        });
        return result.Elements.Where(o => o.PreferenceId == order.MercadoPagoPreferenceId &&
                o.ExternalReference == order.IdOrder.ToString(CultureInfo.InvariantCulture))
            .SelectMany(o => o.Payments ?? [])
            .Where(p => p.Id > 0)
            .OrderByDescending(p => p.Status == "approved")
            .ThenByDescending(p => p.Status is "pending" or "in_process" or "authorized")
            .ThenByDescending(p => p.LastModified)
            .Select(p => p.Id).FirstOrDefault();
    }

    public async Task<PaymentPreferenceResponse> CreatePreferenceAsync(Order order)
    {
        var frontend = (config["Store:FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var webhook = config["Store:WebhookUrl"];
        if (!PaymentUrls.IsValidWebhook(webhook))
            throw new InvalidOperationException("Configurá Store:WebhookUrl con la URL pública HTTPS de la API.");
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
                Success = $"{frontend}/checkout/result?orderId={order.IdOrder}&status=approved",
                Failure = $"{frontend}/checkout/result?orderId={order.IdOrder}&status=failure",
                Pending = $"{frontend}/checkout/result?orderId={order.IdOrder}&status=pending",
            },

            ExternalReference = order.IdOrder.ToString(),
            // Configuracion destino Webhook
            NotificationUrl = webhook,
            Expires = true,
            ExpirationDateFrom = DateTime.UtcNow,
            ExpirationDateTo = DateTime.UtcNow.AddMinutes(30),
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

    public async Task<VerifiedPayment> VerifyPaymentStatusAsync(
        long paymentId
    )
    {
        // Instanciacion cliente pagos MP
        var client = new PaymentClient();

        // Obtencion datos oficiales desde MP
        Payment payment = await client.GetAsync(paymentId);

        return new VerifiedPayment(payment.Id, payment.Status, payment.ExternalReference,
            payment.TransactionAmount, payment.CurrencyId, payment.DateApproved?.ToUniversalTime());
    }
}
