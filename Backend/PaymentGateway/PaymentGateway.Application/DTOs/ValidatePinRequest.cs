namespace PaymentGateway.Application.DTOs;

public class ValidatePinRequest
{
    public string Email { get; set; } = null!;
    public string Pin { get; set; } = null!;
}
