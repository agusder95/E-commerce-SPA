namespace PaymentGateway.Application.DTOs;

public class WebhookPayload
{
    public string Action { get; set; }
    public WebhookData Data { get; set; }
}

public class WebhookData
{
    public string Id { get; set; }
}
