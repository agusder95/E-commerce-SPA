namespace PaymentGateway.Infrastructure.Services;

public sealed record AccessCodeEmail(string Subject, string Text, string Html)
{
    public static AccessCodeEmail Create(string pin, int lifetimeSeconds = 300)
    {
        var duration = lifetimeSeconds % 60 == 0
            ? $"{lifetimeSeconds / 60} minutos" : $"{lifetimeSeconds} segundos";
        var content = $"""
            <p style="margin:0 0 24px;font-size:15px;color:#59695e;">Usá este código para ingresar a tu cuenta de Juegos Fueguinos AMB.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px;background:#edf3ed;border:1px solid #dce5dc;border-radius:10px;">
            <span style="font-size:11px;color:#526258;">Tu código de acceso</span><br>
            <strong style="font-family:Arial,Helvetica,sans-serif;font-size:38px;line-height:1.6;letter-spacing:6px;color:#345343;">{EmailLayout.Encode(pin)}</strong>
            </td></tr></table>
            <p style="margin:20px 0 0;font-size:13px;color:#59695e;">Este código expira en <strong>{duration}</strong>. No lo compartas con nadie.</p>
            <p style="margin:14px 0 0;font-size:12px;color:#59695e;">Si no solicitaste este código, podés ignorar este correo.</p>
            """;
        var text = $"Juegos Fueguinos AMB\n\nUsá este código para ingresar a tu cuenta.\n\nTu código de seguridad es: {pin}\n\n" +
            $"Este código expira en {duration}. No lo compartas con nadie.\nSi no solicitaste este código, podés ignorar este correo.\n\n{EmailLayout.ContactText}";
        return new("Tu código de acceso seguro", text, EmailLayout.Render("Tu código de acceso", "Tu código para ingresar a Juegos Fueguinos AMB.", content));
    }
}
