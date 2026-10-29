namespace PaymentGateway.Application.DTOs;

public class PaymentPreferenceResponse
{
    public string PreferenceId { get; set; } = null!;

    // La URL oficial de Mercado Pago a donde debes redirigir al usuario
    public string InitPoint { get; set; } = null!;
}
