using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class GeneratePinRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    // Se utiliza al volver desde la pantalla del PIN para no solicitarlo
    // nuevamente para el mismo correo.
    public string? PreviousEmail { get; set; }
}
