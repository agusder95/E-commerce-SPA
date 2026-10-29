using System.Net;

namespace PaymentGateway.Infrastructure.Services;

public static class EmailLayout
{
    public const string ContactEmail = "juegosfueguinosamb@gmail.com";
    public const string LogoContentId = "juegos-fueguinos-logo";
    public const string ContactText =
        "Este es un correo automático. No respondas a este mensaje. Para consultas, escribinos a "
        + ContactEmail
        + ".";

    public static string Encode(string value) => WebUtility.HtmlEncode(value);

    public static readonly Lazy<string> LogoBase64 = new(() =>
    {
        using var stream =
            typeof(EmailLayout).Assembly.GetManifestResourceStream("PaymentGateway.EmailLogo.png")
            ?? throw new InvalidOperationException("No se encontró el logo de los correos.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return Convert.ToBase64String(buffer.ToArray());
    });

    public static string Render(string title, string preview, string content) =>
        $$"""
            <!DOCTYPE html>
            <html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{{Encode(
                title
            )}}</title>
            <style>@media only screen and (max-width:600px) { .email-content { padding:24px 18px !important; } .email-outer { padding:20px 10px !important; } .email-title { font-size:25px !important; } }</style></head>
            <body style="margin:0;padding:0;background:#f0f4ed;color:#29352e;font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
            <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{{Encode(
                preview
            )}}</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f4ed;"><tr><td class="email-outer" align="center" style="padding:40px 16px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce5dc;border-radius:14px;">
            <tr><td class="email-content" style="padding:32px 36px 24px;border-bottom:1px solid #dce5dc;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="76" style="vertical-align:middle;"><img src="cid:{{LogoContentId}}" width="60" height="80" alt="Logo de Juegos Fueguinos AMB" style="display:block;border:0;object-fit:contain;"></td><td style="vertical-align:middle;"><strong style="font-size:21px;line-height:1.3;color:#345343;">Juegos Fueguinos AMB</strong><br><span style="font-size:12px;color:#59695e;">Conocer, jugar y cuidar.</span></td></tr></table>
            </td></tr>
            <tr><td class="email-content" style="padding:32px 36px 36px;">
            <h1 class="email-title" style="margin:0 0 18px;font-size:29px;font-weight:600;line-height:1.25;letter-spacing:-0.6px;color:#29352e;">{{Encode(
                title
            )}}</h1>
            {{content}}
            </td></tr>
            <tr><td class="email-content" style="padding:24px 36px;background:#f7f9f5;border-top:1px solid #dce5dc;border-radius:0 0 14px 14px;">
            <p style="margin:0 0 8px;font-size:12px;color:#59695e;">Este es un correo automático. <strong>No respondas a este mensaje.</strong></p>
            <p style="margin:0;font-size:12px;color:#59695e;">Para consultas, escribinos a<br><a href="mailto:{{ContactEmail}}" style="color:#345343;text-decoration:underline;overflow-wrap:anywhere;">{{ContactEmail}}</a></p>
            </td></tr></table>
            <p style="margin:20px 0 0;font-size:11px;color:#59695e;">Desde Ushuaia, inspirados en nuestra naturaleza.</p>
            </td></tr></table></body></html>
            """;
}
