namespace PaymentGateway.Application.DTOs;

public class WebhookPayload
{
    public System.Text.Json.JsonElement? Id { get; set; }
    public string? Action { get; set; }
    public WebhookData? Data { get; set; }
}

public class WebhookData
{
    public string? Id { get; set; }
}
