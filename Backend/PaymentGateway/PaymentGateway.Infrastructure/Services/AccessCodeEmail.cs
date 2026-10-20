using System.Net;

namespace PaymentGateway.Infrastructure.Services;

public sealed record AccessCodeEmail(string Subject, string Text, string Html)
{
    public static AccessCodeEmail Create(string pin, int lifetimeSeconds = 300)
    {
        var duration = lifetimeSeconds % 60 == 0
            ? $"{lifetimeSeconds / 60} minutos" : $"{lifetimeSeconds} segundos";
        var htmlBody = $@"<!DOCTYPE html>
<html lang=""es"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Código de acceso seguro</title>
</head>
<body style=""margin:0; padding:0; background-color:#ffffff;"">
    <div style=""font-family:Arial,sans-serif; padding:20px; color:#333333;"">
        <h2 style=""color:#2E8B57;"">¡Hola!</h2>
        <p>Solicitaste acceso al portal para descargar tu manual.</p>
        <p>Tu código de seguridad es:</p>
        <div style=""background-color:#f4f4f4; padding:15px; border-radius:8px; display:inline-block;"">
            <h1 style=""margin:0; color:#333333; letter-spacing:5px;"">{WebUtility.HtmlEncode(pin)}</h1>
        </div>
        <p style=""margin-top:20px; font-size:14px; color:#666666;"">
            Este código expira en {duration}. No lo compartas con nadie.
        </p>
    </div>
</body>
</html>";

        var textBody = $@"¡Hola!

Solicitaste acceso al portal para descargar tu manual.

Tu código de seguridad es: {pin}

Este código expira en {duration}. No lo compartas con nadie.";

        return new("Tu código de acceso seguro", textBody, htmlBody);
    }
}
