using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Services;

internal static class EmailTemplateChecks
{
    public static void Run(Action<bool, string> check)
    {
        var order = SampleOrder();
        var pin = AccessCodeEmail.Create("012345", 90);
        var purchase = PurchaseEmail.Create(order, "https://tienda.example", "https://www.instagram.com/brandoni.andrea/");
        foreach (var (name, text, html) in new[] { ("PIN", pin.Text, pin.Html), ("purchase", purchase.Text, purchase.Html) })
        {
            check(text.Contains("No respondas a este mensaje") && html.Contains("No respondas a este mensaje") &&
                text.Contains(EmailLayout.ContactEmail) && html.Contains($"mailto:{EmailLayout.ContactEmail}"),
                $"Email {name}: text and HTML explain no-reply and provide the store contact");
            check(html.Contains("Juegos Fueguinos AMB") && html.Contains($"cid:{EmailLayout.LogoContentId}") && html.Contains("max-width:600px"),
                $"Email {name}: branded, responsive layout with an inline logo");
        }
        check(pin.Text.Contains("012345") && pin.Html.Contains("012345") && pin.Text.Contains("90 segundos") &&
            pin.Html.Contains("Si no solicitaste este código"), "Email PIN: preserves leading zeros and expiration, with unsolicited-request instructions");
        var malicious = AccessCodeEmail.Create("<script>alert(1)</script>");
        check(!malicious.Html.Contains("<script>") && malicious.Html.Contains("&lt;script&gt;"), "Email PIN: injected content is escaped");
        check(purchase.Html.Contains("&lt;aves&gt;") && !purchase.Html.Contains("<aves>") &&
            purchase.Html.Contains("Tus archivos digitales") && purchase.Html.Contains("Entrega de productos físicos") &&
            purchase.Text.Contains("Total pagado: ARS 15.000,00"), "Email purchase: mixed-order details, delivery, downloads and total remain accurate");
        order.Items = order.Items.Where(i => i.ProductType == "DIGITAL").ToList();
        var digital = PurchaseEmail.Create(order, "https://tienda.example", "https://www.instagram.com/brandoni.andrea/");
        check(!digital.Html.Contains("Entrega de productos físicos") && !digital.Text.Contains("Instagram"),
            "Email purchase: digital-only confirmation omits physical pickup instructions");
        order.Status = "PAID_REQUIRES_REVIEW";
        check(PurchaseEmail.Create(order, "https://tienda.example", null).Html.Contains("revisando la disponibilidad"),
            "Email purchase: availability-review explanation remains visible");
    }

    public static void WritePreviews(string directory)
    {
        Directory.CreateDirectory(directory);
        var pin = AccessCodeEmail.Create("012345");
        var purchase = PurchaseEmail.Create(SampleOrder(), "https://tienda.example", "https://www.instagram.com/brandoni.andrea/");
        foreach (var (name, html) in new[] { ("codigo", pin.Html), ("compra", purchase.Html) })
            File.WriteAllText(Path.Combine(directory, name + ".html"), html.Replace($"cid:{EmailLayout.LogoContentId}", $"data:image/png;base64,{EmailLayout.LogoBase64.Value}"));
    }

    private static Order SampleOrder() => new() { IdOrder = 42, Status = "APPROVED", TotalAmount = 15000m,
        Items = [new() { ProductName = "Memotest de aves fueguinas", ProductType = "DIGITAL", Quantity = 1, FinalPrice = 5000m },
            new() { ProductName = "Rompecabezas del bosque <aves>", ProductType = "PHYSICAL", Quantity = 2, FinalPrice = 5000m }] };
}
