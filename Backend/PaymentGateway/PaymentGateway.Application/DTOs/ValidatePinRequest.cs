using System.ComponentModel.DataAnnotations;

namespace PaymentGateway.Application.DTOs;

public class ValidatePinRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(254)]
    public string Email { get; set; } = null!;

    [Required]
    [RegularExpression(@"^[0-9]{6}$")]
    public string Pin { get; set; } = null!;
}
