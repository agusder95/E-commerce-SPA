using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class ValidatePinRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    [RegularExpression(@"^\d{6}$")]
    public string Pin { get; set; } = null!;
}
