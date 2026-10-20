using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class GeneratePinRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = null!;

    // Se utiliza al volver desde la pantalla del PIN para no solicitarlo
    // nuevamente para el mismo correo.
    [MaxLength(254)]
    public string? PreviousEmail { get; set; }
}
