using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Services;

public sealed class ResendEmailService(HttpClient http, IOptions<ResendOptions> options,
    IConfiguration config, ILogger<ResendEmailService> logger, IOptions<PinLoginOptions> pinOptions) : IEmailService
{
    public Task SendPinEmailAsync(string toEmail, string pin)
    {
        var content = AccessCodeEmail.Create(pin, pinOptions.Value.LifetimeSeconds);
        // Every newly issued PIN is a separate message, even if the digits repeat.
        return SendAsync(toEmail, content.Subject, content.Text, content.Html, $"access-code/{Guid.NewGuid():N}");
    }

    public Task SendPurchaseConfirmationAsync(string toEmail, Order order)
    {
        var content = PurchaseEmail.Create(order, config["Store:FrontendUrl"], config["Store:InstagramUrl"]);
        return SendAsync(toEmail, content.Subject, content.Text, content.Html, $"purchase-confirmation/{order.IdOrder}", copyToStore: true);
    }

    private async Task SendAsync(string toEmail, string subject, string text, string html, string idempotencyKey, bool copyToStore = false)
    {
        var settings = options.Value;
        var payload = new
        {
            from = new MailAddress(settings.FromEmail, settings.FromName).ToString(),
            to = new[] { toEmail }, subject, text, html,
            // Copy the confirmation privately in the same idempotent delivery operation.
            // Access codes never include the store as a recipient.
            bcc = copyToStore && !toEmail.Equals(EmailLayout.ContactEmail, StringComparison.OrdinalIgnoreCase)
                ? new[] { EmailLayout.ContactEmail } : null,
            reply_to = settings.ReplyTo,
            attachments = new[] { new { filename = "juegos-fueguinos-logo.png", content = EmailLayout.LogoBase64.Value,
                content_type = "image/png", content_id = EmailLayout.LogoContentId } },
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.UserAgent.ParseAdd("PaymentGateway/1.0");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
        request.Headers.Add("Idempotency-Key", idempotencyKey);
        request.Content = JsonContent.Create(payload, options: new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        });
        using var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var (code, hint) = await DescribeFailureAsync(response);
            // Only log known codes and our own explanations, never the raw provider message.
            logger.LogWarning("Resend rechazó el envío de correo. HTTP {StatusCode}. Código: {Code}. {Hint}", (int)response.StatusCode, code, hint);
            throw new HttpRequestException($"No se pudo enviar el correo con Resend (HTTP {(int)response.StatusCode}; {code}). {hint}", null, response.StatusCode);
        }
        try
        {
            var result = await response.Content.ReadFromJsonAsync<SendResult>();
            if (string.IsNullOrWhiteSpace(result?.Id))
                throw new InvalidOperationException("Resend no confirmó la aceptación del correo.");
            logger.LogInformation("Correo aceptado por Resend. Id: {EmailId}.", result.Id);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("Resend devolvió una respuesta de envío inválida.");
        }
    }

    private sealed record SendResult(string Id);

    private static async Task<(string Code, string Hint)> DescribeFailureAsync(HttpResponseMessage response)
    {
        try
        {
            var error = await response.Content.ReadFromJsonAsync<ProviderError>();
            return error?.Name switch
            {
                "validation_error" when error.Message?.Contains("only send testing emails", StringComparison.OrdinalIgnoreCase) == true =>
                    ("testing_recipient_restricted", "El remitente de prueba sólo permite enviar al email de la cuenta de Resend. Para otros destinatarios, verificá un dominio y configurá Resend:FromEmail con ese dominio."),
                "validation_error" when error.Message?.Contains("domain is not verified", StringComparison.OrdinalIgnoreCase) == true =>
                    ("sender_domain_not_verified", "El dominio remitente no está verificado. Verificá el dominio en Resend y usá una dirección de ese dominio en Resend:FromEmail; Gmail, Outlook y otros dominios públicos no sirven como remitente propio."),
                "invalid_permission" => ("invalid_permission", "La API key no tiene permiso para enviar desde este dominio. Revisá sus permisos y el dominio autorizado en Resend."),
                "restricted_api_key" => ("restricted_api_key", "La API key está restringida o inactiva. Revisá su estado y sus permisos de envío en Resend."),
                "suspended_api_key" => ("suspended_api_key", "La API key está suspendida. Revisá el estado de la cuenta con Resend."),
                "missing_api_key" => ("missing_api_key", "Configurá Resend:ApiKey en el backend."),
                "validation_error" => ("validation_error", "Revisá Resend:FromEmail, la verificación del dominio, el destinatario y la API key. Consultá el detalle privado en los logs de Resend."),
                _ => ("unclassified_error", "Consultá el detalle privado del rechazo en los logs de Resend."),
            };
        }
        catch (Exception ex) when (ex is JsonException or NotSupportedException)
        {
            return ("unclassified_error", "Resend no devolvió un error JSON reconocible. Consultá sus logs para conocer el motivo.");
        }
    }

    private sealed record ProviderError(string? Name, string? Message);
}
