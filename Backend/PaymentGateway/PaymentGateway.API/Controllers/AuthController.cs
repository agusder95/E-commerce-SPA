using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Services;
using StackExchange.Redis;

namespace PaymentGateway.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    IPinChallengeStore challenges,
    IEmailService emailService,
    ITokenService tokenService,
    ICustomerRepository customers,
    PinProof proof,
    IOptions<PinLoginOptions> options,
    ILogger<AuthController> logger) : ControllerBase
{
    [HttpPost("request-access")]
    public async Task<IActionResult> RequestAccess([FromBody] GeneratePinRequest request)
    {
        Response.Headers.CacheControl = "no-store";
        var email = request.Email.Trim().ToLowerInvariant();
        if (request.PreviousEmail is not null &&
            string.Equals(email, request.PreviousEmail.Trim(), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { Message = "Ingresa un email diferente al anterior." });

        var subject = PinProof.Identifier(email);
        var challenge = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));
        var pin = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture);
        try
        {
            var result = await challenges.TryIssueAsync(subject, Client(), challenge, proof.Create(email, challenge, pin));
            if (result.Status != PinAttemptStatus.Issued) return Throttled(result);
        }
        catch (Exception exception) when (exception is RedisException or TimeoutException)
        {
            return Unavailable(exception);
        }

        try
        {
            await emailService.SendPinEmailAsync(email, pin);
        }
        catch (Exception exception)
        {
            // A delayed email provider failure must never revoke a newer challenge.
            try { await challenges.RevokeAsync(subject, challenge); }
            catch (Exception revokeException) when (revokeException is RedisException or TimeoutException)
            {
                logger.LogWarning("No se pudo revocar un PIN tras un fallo de envío ({ErrorType}).", revokeException.GetType().Name);
            }
            return Unavailable(exception);
        }

        return Ok(new
        {
            Message = "Si el correo es válido, hemos enviado un PIN de 6 dígitos.",
            ExpiresIn = $"{options.Value.LifetimeSeconds / 60.0:0.##} minutes",
            ExpiresInSeconds = options.Value.LifetimeSeconds,
            ResendAfterSeconds = options.Value.ResendSeconds
        });
    }

    [HttpPost("verify-access")]
    public async Task<IActionResult> VerifyAccess([FromBody] ValidatePinRequest request)
    {
        Response.Headers.CacheControl = "no-store";
        var email = request.Email.Trim().ToLowerInvariant();
        var subject = PinProof.Identifier(email);
        PinAttemptResult result;
        try
        {
            var challenge = await challenges.GetChallengeIdAsync(subject);
            result = await challenges.TryConsumeAsync(subject, Client(), challenge, proof.Create(email, challenge ?? "", request.Pin));
        }
        catch (Exception exception) when (exception is RedisException or TimeoutException)
        {
            return Unavailable(exception);
        }
        if (result.Status == PinAttemptStatus.Throttled) return Throttled(result);
        if (result.Status != PinAttemptStatus.Verified)
            return BadRequest(new { Message = "El PIN es incorrecto o ha expirado." });

        // Redis consumes the challenge atomically BEFORE touching the DB or issuing a token.
        var customer = await customers.GetCustomerByEmailAsync(email)
            ?? await customers.CreateCustomerAsync(new Customer { Email = email });
        var token = tokenService.GenerateToken(email, customer.IdCustomer, customer.Role);
        return Ok(new { Message = "Autenticación exitosa.", Token = token });
    }

    private string Client()
    {
        var address = HttpContext.Connection.RemoteIpAddress;
        if (address?.IsIPv4MappedToIPv6 == true) address = address.MapToIPv4();
        // Forwarded headers must only be processed by explicitly configured trusted proxies.
        return PinProof.Identifier(address?.ToString() ?? "unknown");
    }

    private ObjectResult Throttled(PinAttemptResult result)
    {
        var seconds = Math.Max(1, result.RetryAfterSeconds);
        Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        return StatusCode(StatusCodes.Status429TooManyRequests, new
        {
            Code = "PIN_RATE_LIMITED",
            Message = $"Demasiados intentos. Volvé a intentar en {seconds} segundos.",
            RetryAfterSeconds = seconds
        });
    }

    private ObjectResult Unavailable(Exception exception)
    {
        // Email provider/Redis exceptions can contain addresses or credentials; never expose their details.
        logger.LogWarning("Login por PIN temporalmente no disponible ({ErrorType}).", exception.GetType().Name);
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new
        {
            Code = "PIN_UNAVAILABLE", Message = "No pudimos completar el acceso. Volvé a intentar más tarde."
        });
    }
}
