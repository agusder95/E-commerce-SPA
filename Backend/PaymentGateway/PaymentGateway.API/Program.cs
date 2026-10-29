using MercadoPago.Config;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.API.Security;
using PaymentGateway.Infrastructure.Persistence;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Infrastructure.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

//Contenedor de Inyeccion de Dependencias/Servicios
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddOptions<PinLoginOptions>()
    .Bind(builder.Configuration.GetSection(PinLoginOptions.Section))
    .ValidateDataAnnotations()
    .Validate(options => options.ResendSeconds <= options.LifetimeSeconds, "ResendSeconds no puede superar LifetimeSeconds.")
    .Validate(options => !string.IsNullOrWhiteSpace(options.RedisKeyPrefix) && !options.RedisKeyPrefix.Contains('{') && !options.RedisKeyPrefix.Contains('}'), "RedisKeyPrefix no debe contener llaves.")
    .ValidateOnStart();
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var redis = ConfigurationOptions.Parse(builder.Configuration.GetConnectionString("RedisConnection")
        ?? throw new InvalidOperationException("Falta configurar ConnectionStrings:RedisConnection."));
    redis.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(redis);
});
builder.Services.AddSingleton<PinProof>();
builder.Services.AddScoped<IPinChallengeStore, RedisPinChallengeStore>();
builder.Services.AddOptions<PaymentGateway.Infrastructure.Services.PaymentTrackingOptions>()
    .Bind(builder.Configuration.GetSection(PaymentGateway.Infrastructure.Services.PaymentTrackingOptions.Section))
    .ValidateDataAnnotations()
    .Validate(options => options.MaximumCheckSeconds >= options.InitialCheckSeconds,
        "MaximumCheckSeconds debe ser mayor o igual a InitialCheckSeconds.")
    .Validate(options => options.BackgroundRequestsPerMinute < options.ProviderRequestsPerMinute,
        "El presupuesto de respaldo debe reservar solicitudes para avisos y checkouts.")
    .ValidateOnStart();
builder.Services.AddHttpClient<PaymentGateway.Application.Interfaces.IAssetStorage,
    PaymentGateway.Infrastructure.Services.AssetStorage>();

//Contenedor de Dependencias PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<PaymentDbContext>(options =>
{
    options.UseNpgsql(connectionString);
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
builder.Services.AddSingleton<PaymentProviderBudget>();
builder.Services.AddHttpClient("MercadoPago", client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddScoped<IPaymentService>(services => new MercadoPagoService(builder.Configuration,
    services.GetRequiredService<PaymentProviderBudget>(),
    new MercadoPago.Http.DefaultHttpClient(services.GetRequiredService<IHttpClientFactory>().CreateClient("MercadoPago"))));

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

builder.Services.AddOptions<ResendOptions>()
    .Bind(builder.Configuration.GetSection(ResendOptions.Section))
    .ValidateDataAnnotations()
    .Validate(options => !string.IsNullOrWhiteSpace(options.ApiKey) && options.ApiKey.StartsWith("re_") &&
        !options.ApiKey.Any(char.IsWhiteSpace) && !options.ApiKey.Contains("replace", StringComparison.OrdinalIgnoreCase),
        "Configurá Resend:ApiKey con una API key válida de Resend.")
    .ValidateOnStart();
builder.Services.AddHttpClient<IEmailService, ResendEmailService>(client => client.Timeout = TimeSpan.FromSeconds(15));

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

builder.Services.AddSingleton<PaymentGateway.Infrastructure.Services.OrderWorkSignal>();
builder.Services.AddHostedService<PaymentGateway.Infrastructure.Services.PostgresOrderWorkListener>();
builder.Services.AddHostedService<PaymentGateway.Infrastructure.Services.OrderCleanupService>();
builder.Services.AddScoped<PaymentGateway.Application.Interfaces.IPaymentReconciliationService,
    PaymentGateway.Infrastructure.Services.PaymentReconciliationService>();
builder.Services.AddHostedService<PaymentGateway.Infrastructure.Services.PaymentReconciliationWorker>();
builder.Services.AddHostedService<PaymentNotificationWorker>();
builder.Services.AddHostedService<PaymentGateway.Infrastructure.Services.PurchaseEmailService>();

// CONFIGURACION M.P.
var mercadoPagoToken = builder.Configuration["MercadoPago:AccessToken"]
    ?? builder.Configuration["MercadoPago:AccesToken"]; // Compatibilidad con la clave anterior.

if (string.IsNullOrWhiteSpace(mercadoPagoToken))
{
    throw new ArgumentNullException(
        "MercadoPago:AccessToken",
        "Configurá MercadoPago:AccessToken o la variable MercadoPago__AccessToken antes de iniciar la API."
    );
}

// Inyecta el token globalmente para q SDK lo use en c/peticion
MercadoPagoConfig.AccessToken = mercadoPagoToken.Trim();

// Configuración esquema autenticacion
builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = JwtAuthentication.ValidationParameters(builder.Configuration);
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
                    "http://127.0.0.1:5173",
                    builder.Configuration["Store:FrontendUrl"] ?? "http://localhost:5173"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    );
});

var app = builder.Build();
// Reject an unsafe proof-signing key at startup, before serving login requests.
_ = app.Services.GetRequiredService<PinProof>();

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
