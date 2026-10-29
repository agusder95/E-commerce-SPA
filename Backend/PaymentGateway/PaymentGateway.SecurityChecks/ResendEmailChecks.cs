using System.Net;
using System.Net.Mail;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Services;

internal static class ResendEmailChecks
{
    public static async Task RunAsync(Action<bool, string> check)
    {
        var handler = new FakeResendHandler();
        using var http = new HttpClient(handler);
        var resendOptions = new ResendOptions
        {
            ApiKey = "re_test_only", FromEmail = "notificaciones@example.invalid",
            FromName = "Juegos Fueguinos AMB", ReplyTo = "contacto@example.invalid",
        };
        var service = new ResendEmailService(http, Options.Create(resendOptions), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Store:FrontendUrl"] = "https://tienda.example", ["Store:InstagramUrl"] = "https://www.instagram.com/brandoni.andrea/",
        }).Build(), NullLogger<ResendEmailService>.Instance, Options.Create(new PinLoginOptions { LifetimeSeconds = 120 }));
        await service.SendPinEmailAsync("cliente@example.invalid", "123456");
        var pin = handler.Requests[^1];
        check(pin.Method == HttpMethod.Post && pin.Url == "https://api.resend.com/emails" && pin.Auth == "Bearer re_test_only",
            "Resend: sends authenticated HTTPS POST to the email API");
        var body = JsonDocument.Parse(pin.Body).RootElement;
        var from = new MailAddress(body.GetProperty("from").GetString()!);
        check(from.DisplayName == "Juegos Fueguinos AMB" && from.Address == "notificaciones@example.invalid" &&
            body.GetProperty("reply_to").GetString() == "contacto@example.invalid" &&
            body.GetProperty("to")[0].GetString() == "cliente@example.invalid", "Resend: configured brand, recipient and reply address");
        check(body.GetProperty("text").GetString()!.Contains("123456") && body.GetProperty("html").GetString()!.Contains("2 minutos"),
            "Resend: preserves PIN text and HTML with configured expiration");
        check(!body.TryGetProperty("bcc", out _) && body.GetProperty("to").GetArrayLength() == 1,
            "Resend: access codes are sent exclusively to the requesting customer");
        var logo = body.GetProperty("attachments")[0];
        var png = Convert.FromBase64String(logo.GetProperty("content").GetString()!);
        check(logo.GetProperty("content_id").GetString() == EmailLayout.LogoContentId &&
            logo.GetProperty("content_type").GetString() == "image/png" && png.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) &&
            body.GetProperty("html").GetString()!.Contains($"cid:{EmailLayout.LogoContentId}"),
            "Resend: email includes the real embedded PNG logo referenced by CID, without depending on a public frontend URL");
        await service.SendPinEmailAsync("cliente@example.invalid", "123456");
        check(pin.Key != handler.Requests[^1].Key && !pin.Key.Contains("123456"), "Resend: separate PIN issuances use distinct keys without exposing PINs");
        resendOptions.ReplyTo = null;
        await service.SendPinEmailAsync("cliente@example.invalid", "654321");
        check(!JsonDocument.Parse(handler.Requests[^1].Body).RootElement.TryGetProperty("reply_to", out _), "Resend: optional reply address is omitted when not configured");
        var order = new Order { IdOrder = 42, Status = "APPROVED", TotalAmount = 500,
            Items = [new() { ProductName = "Juego <aves>", ProductType = "PHYSICAL", Quantity = 1, FinalPrice = 500 }] };
        await service.SendPurchaseConfirmationAsync("cliente@example.invalid", order);
        var purchase = handler.Requests[^1];
        await service.SendPurchaseConfirmationAsync("cliente@example.invalid", order);
        check(purchase.Key == "purchase-confirmation/42" && purchase.Key == handler.Requests[^1].Key && purchase.Body == handler.Requests[^1].Body,
            "Resend: confirmation retries reuse the order key and identical content");
        body = JsonDocument.Parse(purchase.Body).RootElement;
        check(body.GetProperty("html").GetString()!.Contains("Juego &lt;aves&gt;") && body.GetProperty("text").GetString()!.Contains("https://tienda.example/my-purchases"),
            "Resend: purchase confirmation preserves escaped HTML and purchases link");
        check(body.GetProperty("to").GetArrayLength() == 1 && body.GetProperty("to")[0].GetString() == "cliente@example.invalid" &&
            body.GetProperty("bcc").GetArrayLength() == 1 && body.GetProperty("bcc")[0].GetString() == "juegosfueguinosamb@gmail.com",
            "Resend: paid purchase sends the customer confirmation and a private copy to the store in one idempotent request");
        await service.SendPurchaseConfirmationAsync("JuegosFueguinosAMB@gmail.com", order);
        check(!JsonDocument.Parse(handler.Requests[^1].Body).RootElement.TryGetProperty("bcc", out _),
            "Resend: buying with the store address does not duplicate the recipient");
        handler.Status = HttpStatusCode.InternalServerError;
        try { await service.SendPurchaseConfirmationAsync("cliente@example.invalid", order); check(false, "Resend: rejected purchase notification must fail"); }
        catch (HttpRequestException) { check(true, "Resend: rejected customer/store confirmation propagates for the durable worker retry"); }
        handler.Status = HttpStatusCode.OK;
        await service.SendPurchaseConfirmationAsync("cliente@example.invalid", order);
        check(handler.Requests[^1].Key == purchase.Key && handler.Requests[^1].Body == purchase.Body,
            "Resend: retry after purchase notification failure keeps the same customer, store copy, template and idempotency key");
        foreach (var status in new[] { HttpStatusCode.BadRequest, HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden,
            HttpStatusCode.Conflict, HttpStatusCode.TooManyRequests, HttpStatusCode.InternalServerError })
        {
            handler.Status = status;
            try { await service.SendPinEmailAsync("cliente@example.invalid", "654321"); check(false, $"Resend: HTTP {(int)status} must fail"); }
            catch (HttpRequestException ex)
            {
                check(ex.StatusCode == status && !ex.ToString().Contains("private-provider-detail") && !ex.ToString().Contains("re_test_only"),
                    $"Resend: HTTP {(int)status} propagates safely for existing login/worker error handling");
            }
        }
        handler.Status = HttpStatusCode.Forbidden;
        foreach (var (name, message, expected) in new[]
        {
            ("validation_error", "You can only send testing emails to your own email address private-provider-detail", "testing_recipient_restricted"),
            ("validation_error", "The private-provider-detail domain is not verified. Please, add and verify your domain.", "sender_domain_not_verified"),
            ("invalid_permission", "private-provider-detail", "invalid_permission"),
            ("restricted_api_key", "private-provider-detail", "restricted_api_key"),
            ("suspended_api_key", "private-provider-detail", "suspended_api_key"),
            ("unexpected-private-provider-detail", "private-provider-detail", "unclassified_error"),
        })
        {
            handler.ErrorResult = JsonSerializer.Serialize(new { name, message });
            try { await service.SendPinEmailAsync("cliente@example.invalid", "654321"); check(false, "Resend: rejected message must fail"); }
            catch (HttpRequestException ex)
            {
                check(ex.Message.Contains(expected) && !ex.ToString().Contains("private-provider-detail"),
                    $"Resend: diagnostic {expected} explains the rejection without exposing provider data");
            }
        }
        handler.Status = HttpStatusCode.OK;
        foreach (var result in new[] { "{}", "null", "{\"id\":\"\"}", "not-json" })
        {
            handler.Result = result;
            try { await service.SendPinEmailAsync("cliente@example.invalid", "654321"); check(false, "Resend: invalid response must fail"); }
            catch (InvalidOperationException) { check(true, "Resend: missing/malformed acceptance is never recorded as successful delivery"); }
        }
        handler.ThrowNetworkError = true;
        try { await service.SendPinEmailAsync("cliente@example.invalid", "654321"); check(false, "Resend: network failure must propagate"); }
        catch (HttpRequestException) { check(true, "Resend: network errors propagate without silently accepting mail"); }
    }

    private sealed record CapturedRequest(HttpMethod Method, string? Url, string? Auth, string Key, string Body);
    private sealed class FakeResendHandler : HttpMessageHandler
    {
        public List<CapturedRequest> Requests { get; } = [];
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
        public string Result { get; set; } = "{\"id\":\"fake-email-id\"}";
        public string ErrorResult { get; set; } = "private-provider-detail";
        public bool ThrowNetworkError { get; set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Headers.UserAgent.ToString() != "PaymentGateway/1.0")
                throw new InvalidOperationException("Missing Resend user agent.");
            Requests.Add(new(request.Method, request.RequestUri?.AbsoluteUri, request.Headers.Authorization?.ToString(),
                request.Headers.GetValues("Idempotency-Key").Single(), await request.Content!.ReadAsStringAsync(cancellationToken)));
            if (ThrowNetworkError) throw new HttpRequestException("Simulated network error");
            return new HttpResponseMessage(Status) { Content = new StringContent(Status == HttpStatusCode.OK ? Result : ErrorResult) };
        }
    }
}
