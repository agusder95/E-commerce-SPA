using System.Text;
using MercadoPago.Config;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PaymentGateway.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

//Contenedor de Inyeccion de Dependencias/Servicios
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

//Contenedor de Dependencias SQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<PaymentDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});

//Contenedor de Dependencias Redis
var redisConnectionString = builder.Configuration.GetConnectionString("RedisConnection");

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConnectionString;
    // Prefijo para que nuestras llaves no choquen con otras apps
    options.InstanceName = "PaymentGateway_";
});

//Contenedor de Dependencias de pago
builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.IPaymentService,
    PaymentGateway.Infrastructure.Services.MercadoPagoService
>();

//Registro Repositorio (Interfaz -> Implementación)
builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.IOrderRepository,
    PaymentGateway.Infrastructure.Repositories.OrderRepository
>();

builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.ICustomerRepository,
    PaymentGateway.Infrastructure.Repositories.CustomerRepository
>();

builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.ICacheService,
    PaymentGateway.Infrastructure.Services.RedisCacheService
>();

builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.IEmailService,
    PaymentGateway.Infrastructure.Services.SmtpEmailService
>();

//JWT
builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.ITokenService,
    PaymentGateway.Infrastructure.Services.JwtTokenService
>();

builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.IOrderService,
    PaymentGateway.Infrastructure.Services.OrderService
>();

builder.Services.AddScoped<
    PaymentGateway.Application.Interfaces.IProductRepository,
    PaymentGateway.Infrastructure.Repositories.ProductRepository
>();

builder.Services.AddHostedService<PaymentGateway.Infrastructure.Services.OrderCleanupService>();

// CONFIGURACION M.P.
var mercadoPagoToken = builder.Configuration["MercadoPago:AccesToken"];

if (string.IsNullOrEmpty(mercadoPagoToken))
{
    throw new ArgumentNullException(
        "MercadoPago:AccessToken",
        "El token de Mercado Pago no está configurado."
    );
}

// Inyecta el token globalmente para q SDK lo use en c/peticion
MercadoPagoConfig.AccessToken = mercadoPagoToken;

// Configuración esquema autenticacion
builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Definición reglas validacion
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"]!)
            ),
        };
    });

// Activación autorizacion global
builder.Services.AddAuthorization();

// Habilitar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "FrontendPolicy",
        policy =>
        {
            policy
                .WithOrigins(
                    "http://localhost:3000",
                    "http://localhost:5173",
                    " http://localhost:5173"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    );
});

var app = builder.Build();

app.UseMiddleware<PaymentGateway.API.Middleware.ExceptionMiddleware>();

//Configuraciones del pipeline HTTP (Middlewares)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("FrontendPolicy");

//app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
