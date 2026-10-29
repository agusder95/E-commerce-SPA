namespace PaymentGateway.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(string email, int idCustomer, string role);
}
