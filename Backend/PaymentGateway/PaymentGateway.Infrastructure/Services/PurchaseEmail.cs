using System.Globalization;
using System.Net;
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
        string Encode(string value) => WebUtility.HtmlEncode(value);
        var subject = $"Confirmación de tu compra #{order.IdOrder}";
        var intro = $"¡Recibimos tu pago! Tu compra #{order.IdOrder} está confirmada.";
        var review = order.Status == "PAID_REQUIRES_REVIEW"
            ? "Recibimos el pago y estamos revisando la disponibilidad de tus productos. Contactanos para coordinar la entrega." : "";
        var physical = order.Items.Any(i => i.ProductType == "PHYSICAL");
        var delivery = physical ? "Los productos físicos se entregan de manera presencial. Contactanos por Instagram para coordinar la entrega." : "";
        string? instagram = null;
        if (physical && Uri.TryCreate(instagramUrl, UriKind.Absolute, out var social) && social.Scheme == "https" &&
            (social.Host.Equals("instagram.com", StringComparison.OrdinalIgnoreCase) || social.Host.Equals("www.instagram.com", StringComparison.OrdinalIgnoreCase)))
            instagram = social.AbsoluteUri;
        var items = order.Items.Select(i => $"{i.ProductName} × {i.Quantity}: {Money(i.FinalPrice * i.Quantity)}");
        var rows = order.Items.Select(i => $"<li>{Encode(i.ProductName)} × {i.Quantity}: {Encode(Money(i.FinalPrice * i.Quantity))}</li>");
        var text = $"{intro}\n\n{string.Join("\n", items)}\n\nTotal pagado: {Money(order.TotalAmount)}\n\n" +
            $"Ver mis compras: {purchasesUrl}\nSi no tenés una sesión activa, iniciá sesión con el email de esta compra para ver tus compras.\n" +
            (order.Items.Any(i => i.ProductType == "DIGITAL") ? "Los archivos digitales están disponibles en Mis compras.\n" : "") +
            $"{review}\n{delivery}" + (instagram is null ? "" : $"\n{instagram}");
        var html = $"""
            <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
            <body style="font-family:Arial,sans-serif;color:#333;padding:24px">
            <h1>Gracias por tu compra</h1><p>{Encode(intro)}</p>
            <ul>{string.Join("", rows)}</ul><p><strong>Total pagado: {Encode(Money(order.TotalAmount))}</strong></p>
            <p><a href="{Encode(purchasesUrl)}">Ver mis compras</a></p>
            <p>Si no tenés una sesión activa, iniciá sesión con el email de esta compra para ver tus compras.</p>
            {(order.Items.Any(i => i.ProductType == "DIGITAL") ? "<p>Los archivos digitales están disponibles en Mis compras.</p>" : "")}
            {(review.Length > 0 ? $"<p>{Encode(review)}</p>" : "")}
            {(physical ? $"<p>{Encode(delivery)}</p>" : "")}
            {(instagram is null ? "" : $"<p><a href=\"{Encode(instagram)}\">Coordinar entrega por Instagram</a></p>")}
            </body></html>
            """;
        return new(subject, text.Trim(), html);
    }
}
