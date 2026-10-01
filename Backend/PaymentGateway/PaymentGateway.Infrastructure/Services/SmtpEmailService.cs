using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.Infrastructure.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;

    public SmtpEmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendPinEmailAsync(string toEmail, string pin)
    {
        var smtpServer = _config["EmailSettings:SmtpServer"];
        var port = int.Parse(_config["EmailSettings:Port"]!);
        var senderEmail = _config["EmailSettings:SenderEmail"];
        var senderPassword = _config["EmailSettings:SenderPassword"];

        using var client = new SmtpClient(smtpServer, port)
        {
            Credentials = new NetworkCredential(senderEmail, senderPassword),
            EnableSsl = true,
        };

        var mailMessage = new MailMessage
        {
            From = new MailAddress(senderEmail!, "Manuales y Cursos"),
            Subject = "Tu código de acceso seguro",
            Body =
                $@"
                <div style='font-family: Arial, sans-serif; padding: 20px; color: #333;'>
                    <h2 style='color: #2E8B57;'>¡Hola!</h2>
                    <p>Solicitaste acceso al portal para descargar tu manual.</p>
                    <p>Tu código de seguridad es:</p>
                    <div style='background-color: #f4f4f4; padding: 15px; border-radius: 8px; display: inline-block;'>
                        <h1 style='margin: 0; color: #333; letter-spacing: 5px;'>{pin}</h1>
                    </div>
                    <p style='margin-top: 20px; font-size: 14px; color: #666;'>
                        <em>Este código expira en 5 minutos. No lo compartas con nadie.</em>
                    </p>
                </div>",
            IsBodyHtml = true,
        };

        mailMessage.To.Add(toEmail);

        await client.SendMailAsync(mailMessage);
    }
}
