using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace PaymentGateway.API.Security;

public static class JwtAuthentication
{
    // Shared by the application and HTTP security checks so tests exercise the production rules.
    public static TokenValidationParameters ValidationParameters(IConfiguration configuration) => new()
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = configuration["JwtSettings:Issuer"],
        ValidAudience = configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["JwtSettings:SecretKey"]!)),
    };
}
