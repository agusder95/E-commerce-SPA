using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PinProof
{
    private readonly byte[] _key;
    public PinProof(IConfiguration configuration)
    {
        var secret = configuration["JwtSettings:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
            throw new InvalidOperationException("Configurá JwtSettings:SecretKey con al menos 32 bytes para proteger el login.");
        // A separate derived key/domain; a Redis dump must not permit offline guesses of a six-digit PIN.
        _key = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes("PaymentGateway.PinLogin.v1"));
    }

    public static string Identifier(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public string Create(string email, string challengeId, string pin) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"{email}\n{challengeId}\n{pin}")));
}
