using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ICacheService _cacheService;
    private readonly IEmailService _emailService;
    private readonly ITokenService _tokenService;
    private readonly ICustomerRepository _customerRepository;

    // Inyeccion de herramientas de seguridad
    public AuthController(
        ICacheService cacheService,
        IEmailService emailService,
        ITokenService tokenService,
        ICustomerRepository customerRepository
    )
    {
        _cacheService = cacheService;
        _emailService = emailService;
        _tokenService = tokenService;
        _customerRepository = customerRepository;
    }

    [HttpPost("request-access")]
    public async Task<IActionResult> RequestAccess([FromBody] GeneratePinRequest request)
    {
        var pin = new Random().Next(100000, 999999).ToString();
        var cacheKey = $"PIN_{request.Email}";

        await _cacheService.SetCacheValueAsync(cacheKey, pin, TimeSpan.FromMinutes(5));
        await _emailService.SendPinEmailAsync(request.Email, pin);

        return Ok(
            new
            {
                Message = "Si el correo es válido, hemos enviado un PIN de 6 dígitos.",
                ExpiresIn = "5 minutes",
            }
        );
    }

    [HttpPost("verify-access")]
    public async Task<IActionResult> VerifyAccess([FromBody] ValidatePinRequest request)
    {
        var cacheKey = $"PIN_{request.Email}";
        var cachedPin = await _cacheService.GetCacheValueAsync(cacheKey);

        // Agrupado por seguridad
        if (string.IsNullOrEmpty(cachedPin) || cachedPin != request.Pin)
        {
            return BadRequest(new { Message = "El PIN es incorrecto o ha expirado." });
        }

        // Obtener el ID del cliente
        var customer = await _customerRepository.GetCustomerByEmailAsync(request.Email);

        if (customer == null)
        {
            var newCustomer = new Customer { Email = request.Email };

            customer = await _customerRepository.CreateCustomerAsync(newCustomer);
        }

        // Destruccion de PIN (OTP)
        await _cacheService.RemoveCacheValueAsync(cacheKey);

        // Generacion de JWT
        var token = _tokenService.GenerateToken(request.Email, customer.IdCustomer, customer.Role);

        return Ok(
            new
            {
                Message = "Autenticación exitosa.",
                Token = token, // JWT al frontend
            }
        );
    }
}
