using System.Globalization;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Services;

public sealed record PurchaseEmail(string Subject, string Text, string Html)
{
    public static PurchaseEmail Create(Order order, string? frontendUrl, string? instagramUrl)
    {
        if (!Uri.TryCreate(frontendUrl, UriKind.Absolute, out var frontend) ||
            (frontend.Scheme != "https" && frontend.Scheme != "http"))
            throw new InvalidOperationException("Configurá Store:FrontendUrl para el enlace a Mis compras.");
        var purchasesUrl = new Uri(frontend, "/my-purchases").AbsoluteUri;
        var culture = CultureInfo.GetCultureInfo("es-AR");
        string Money(decimal amount) => $"ARS {amount.ToString("N2", culture)}";
        var subject = $"Confirmación de tu compra #{order.IdOrder}";
        var intro = $"¡Recibimos tu pago! Tu compra #{order.IdOrder} está confirmada.";
        var review = order.Status == "PAID_REQUIRES_REVIEW"
            ? "Recibimos el pago y estamos revisando la disponibilidad de tus productos. Contactanos para coordinar la entrega." : "";
        var physical = order.Items.Any(i => i.ProductType == "PHYSICAL");
        var digital = order.Items.Any(i => i.ProductType == "DIGITAL");
        var delivery = physical ? "Los productos físicos se entregan de manera presencial. Contactanos por Instagram para coordinar la entrega." : "";
        string? instagram = null;
        if (physical && Uri.TryCreate(instagramUrl, UriKind.Absolute, out var social) && social.Scheme == "https" &&
            (social.Host.Equals("instagram.com", StringComparison.OrdinalIgnoreCase) || social.Host.Equals("www.instagram.com", StringComparison.OrdinalIgnoreCase)))
            instagram = social.AbsoluteUri;
        var items = order.Items.Select(i => $"{i.ProductName} × {i.Quantity}: {Money(i.FinalPrice * i.Quantity)}");
        var rows = order.Items.Select(i => $"""
            <tr><td style="padding:16px 0;border-bottom:1px solid #dce5dc;vertical-align:top;word-break:break-word;">
            <strong style="font-size:13px;font-weight:600;">{EmailLayout.Encode(i.ProductName)}</strong><br><span style="font-size:11px;color:#59695e;">{(i.ProductType == "PHYSICAL" ? "Físico" : "Digital")} · Cantidad: {i.Quantity}</span>
            </td><td align="right" style="padding:16px 0 16px 12px;border-bottom:1px solid #dce5dc;vertical-align:top;font-size:13px;color:#345343;">{EmailLayout.Encode(Money(i.FinalPrice * i.Quantity))}</td></tr>
            """);
        var text = $"{intro}\n\n{string.Join("\n", items)}\n\nTotal pagado: {Money(order.TotalAmount)}\n\n" +
            $"Ver mis compras: {purchasesUrl}\nSi no tenés una sesión activa, iniciá sesión con el email de esta compra para ver tus compras.\n" +
            (digital ? "Los archivos digitales están disponibles en Mis compras.\n" : "") +
            $"{review}\n{delivery}" + (instagram is null ? "" : $"\n{instagram}") + $"\n\n{EmailLayout.ContactText}";
        var content = $"""
            <p style="margin:0 0 24px;font-size:15px;color:#59695e;">{EmailLayout.Encode(intro)}</p>
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#345343;">Detalle de la compra #{order.IdOrder}</p>
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <thead><tr><th scope="col" align="left" style="padding-bottom:10px;border-bottom:1px solid #dce5dc;font-size:11px;color:#59695e;">Producto</th><th scope="col" align="right" width="40%" style="padding-bottom:10px;border-bottom:1px solid #dce5dc;font-size:11px;color:#59695e;">Importe</th></tr></thead><tbody>{string.Join("", rows)}</tbody></table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 28px;background:#edf3ed;border-radius:8px;"><tr><td style="padding:16px;font-size:13px;color:#345343;">Total pagado</td><td align="right" style="padding:16px 16px 16px 0;font-size:20px;font-weight:600;color:#345343;">{EmailLayout.Encode(Money(order.TotalAmount))}</td></tr></table>
            {(review.Length > 0 ? $"<p style=\"margin:0 0 20px;padding:14px;background:#faf2df;border-radius:8px;color:#70551f;font-size:13px;\">{EmailLayout.Encode(review)}</p>" : "")}
            {(digital ? "<h2 style=\"margin:24px 0 8px;font-size:16px;color:#345343;\">Tus archivos digitales</h2><p style=\"margin:0 0 20px;font-size:13px;color:#59695e;\">Los archivos digitales están disponibles en Mis compras.</p>" : "")}
            {(physical ? $"<h2 style=\"margin:24px 0 8px;font-size:16px;color:#345343;\">Entrega de productos físicos</h2><p style=\"margin:0 0 12px;font-size:13px;color:#59695e;\">{EmailLayout.Encode(delivery)}</p>" : "")}
            {(instagram is null ? "" : $"<p style=\"margin:0 0 24px;font-size:13px;\"><a href=\"{EmailLayout.Encode(instagram)}\" style=\"color:#345343;text-decoration:underline;\">Coordinar entrega por Instagram</a></p>")}
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#345343" style="border-radius:8px;"><a href="{EmailLayout.Encode(purchasesUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Ver mis compras</a></td></tr></table>
            <p style="margin:16px 0 0;font-size:12px;color:#59695e;">Si no tenés una sesión activa, iniciá sesión con el email de esta compra para ver tus compras.</p>
            """;
        return new(subject, text.Trim(), EmailLayout.Render("Gracias por tu compra", intro, content));
    }
}
