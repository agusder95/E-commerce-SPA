using Microsoft.Extensions.Logging;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.Infrastructure.Services;

public class DevEmailService : IEmailService
{
    private readonly ILogger<DevEmailService> _logger;

    public DevEmailService(ILogger<DevEmailService> logger)
    {
        _logger = logger;
    }

    public Task SendPinEmailAsync(string toEmail, string pin)
    {
        // En producción, aquí usaríamos MailKit, SendGrid, etc.
        // Por ahora, lo imprimimos en la consola de Rider simulando el envío.
        _logger.LogInformation("\n=========================================");
        _logger.LogInformation($"[SIMULADOR EMAIL] Enviando a: {toEmail}");
        _logger.LogInformation($"[SIMULADOR EMAIL] Asunto: Tu código de acceso para la compra");
        _logger.LogInformation(
            $"[SIMULADOR EMAIL] Cuerpo: Tu PIN temporal es {pin}. Expira en 5 minutos."
        );
        _logger.LogInformation("=========================================\n");

        return Task.CompletedTask;
    }
}
