using System;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration config, ILogger<SmtpEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task SendPinEmailAsync(string toEmail, string pin)
    {
        var content = AccessCodeEmail.Create(pin);
        return SendAsync(toEmail, content.Subject, content.Text, content.Html);
    }

    public Task SendPurchaseConfirmationAsync(string toEmail, Order order)
    {
        var content = PurchaseEmail.Create(order, _config["Store:FrontendUrl"], _config["Store:InstagramUrl"]);
        return SendAsync(toEmail, content.Subject, content.Text, content.Html);
    }

    private async Task SendAsync(string toEmail, string subject, string textBody, string htmlBody)
    {
        var smtpServer = _config["EmailSettings:SmtpServer"]
            ?? throw new InvalidOperationException("Falta configurar EmailSettings:SmtpServer.");
        var senderEmail = _config["EmailSettings:SenderEmail"]
            ?? throw new InvalidOperationException("Falta configurar EmailSettings:SenderEmail.");
        var senderPassword = _config["EmailSettings:SenderPassword"]
            ?? throw new InvalidOperationException("Falta configurar EmailSettings:SenderPassword.");

        if (!int.TryParse(_config["EmailSettings:Port"], out var port) || port <= 0 || port > 65535)
        {
            throw new InvalidOperationException("EmailSettings:Port debe ser un puerto válido.");
        }

        // Gmail presenta las contraseñas de aplicación en grupos separados por espacios.
        senderPassword = senderPassword.Replace(" ", string.Empty);

        using var client = new SmtpClient(smtpServer, port)
        {
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(senderEmail, senderPassword),
            EnableSsl = true
        };

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(senderEmail, "Manuales y Cursos", Encoding.UTF8),
            Subject = subject,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8
        };

        mailMessage.To.Add(toEmail);
        mailMessage.ReplyToList.Add(new MailAddress(senderEmail));

        mailMessage.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(textBody, Encoding.UTF8, MediaTypeNames.Text.Plain)
        );
        mailMessage.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, MediaTypeNames.Text.Html)
        );

        try
        {
            await client.SendMailAsync(mailMessage);
            _logger.LogInformation("Correo enviado por SMTP a {Email}.", toEmail);
        }
        catch (SmtpException ex)
        {
            _logger.LogError(ex,
                "No se pudo enviar el correo por SMTP a {Email}. Servidor: {Server}:{Port}.",
                toEmail, smtpServer, port);
            throw;
        }
    }
}
