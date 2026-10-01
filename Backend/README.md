# Backend — Payment Gateway API

API REST construida con .NET 10 siguiendo los principios de Clean Architecture. Maneja autenticación por PIN, procesamiento de pagos con MercadoPago y gestión de órdenes de compra.

## Prerrequisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Docker](https://www.docker.com/) (para SQL Server y Redis)
- [ngrok](https://ngrok.com/) (para webhooks de MercadoPago)

## Inicio desde cero (clone recién clonado)

### 1. Levantar infraestructura

Desde la carpeta `PaymentGateway/`:

```bash
docker compose up -d
```

Esto levanta:
- **SQL Server 2022** en `localhost:1433`
- **Redis** en `localhost:6379`

### 2. Restaurar dependencias

```bash
dotnet restore
```

### 3. Configurar la base de datos

Como no hay migraciones en el repositorio, es necesario generarlas:

```bash
dotnet ef migrations add InitialCreate \
  --project PaymentGateway.Infrastructure \
  --startup-project PaymentGateway.API

dotnet ef database update \
  --project PaymentGateway.Infrastructure \
  --startup-project PaymentGateway.API
```

### 4. Configurar variables

Editar el archivo `PaymentGateway.API/appsettings.Development.json` con los valores correspondientes:

| Sección | Descripción |
|---------|------------|
| `ConnectionStrings:DefaultConnection` | Cadena de conexión a SQL Server |
| `ConnectionStrings:RedisConnection` | Dirección de Redis |
| `MercadoPago:AccesToken` | Token de acceso de MercadoPago |
| `JwtSettings:SecretKey` | Clave secreta para firmar JWT (mínimo 32 caracteres) |
| `JwtSettings:Issuer` / `Audience` | Emisor y audiencia del JWT |
| `EmailSettings:SmtpServer`, `Port`, `SenderEmail`, `SenderPassword` | Credenciales SMTP para envío de PINs |

### 5. Configurar webhook de MercadoPago

El webhook de notificaciones de pago está configurado en `PaymentGateway.Infrastructure/Services/MercadoPagoService.cs`. En desarrollo local se usa ngrok para exponer el endpoint:

```bash
ngrok http 5076
```

Copiar la URL pública generada (ej: `https://xxxx.ngrok-free.dev`) y actualizar la propiedad `NotificationUrl` en `MercadoPagoService.cs`.

### 6. Ejecutar la API

```bash
dotnet run --project PaymentGateway.API
```

La API arranca en `http://localhost:5076`. Swagger disponible en `http://localhost:5076/swagger`.

## Estructura de proyectos

```
PaymentGateway/
├── PaymentGateway.API              # Punto de entrada, controllers, middleware
├── PaymentGateway.Application      # Interfaces (IOrderRepository, IEmailService, etc.) y DTOs
├── PaymentGateway.Domain           # Entidades: Order, OrderItem, Customer
├── PaymentGateway.Infrastructure   # Implementaciones: repositorios, servicios, persistencia (EF Core)
├── compose.yaml                    # Docker Compose
└── PaymentGateway.sln
```

La arquitectura sigue el patrón de dependencias invertidas:
- **Domain** no depende de nada
- **Application** solo depende de Domain
- **Infrastructure** depende de Application y Domain
- **API** depende de todas las capas

## Endpoints principales

| Método | Ruta | Auth | Descripción |
|--------|------|------|------------|
| `POST` | `/api/auth/request-access` | No | Envía PIN de 6 dígitos al email (expira en 5 min) |
| `POST` | `/api/auth/verify-access` | No | Valida PIN y devuelve JWT |
| `POST` | `/api/checkout/create-order` | Sí | Crea orden + preferencia de MercadoPago |
| `POST` | `/api/checkout/webhook` | No | Webhook de notificaciones de MercadoPago |
| `GET` | `/api/Order/{idOrder}` | No | Obtiene estado de una orden |
| `GET` | `/api/orders/my-purchases` | Sí | Órdenes aprobadas del usuario |
| `GET` | `/api/orders/my-purchases-pending` | Sí | Órdenes pendientes/canceladas del usuario |

## Servicios del backend

| Servicio | Descripción |
|----------|------------|
| `MercadoPagoService` | Creación de preferencias y verificación de pagos |
| `SmtpEmailService` | Envío de emails con PIN via Gmail SMTP |
| `RedisCacheService` | Almacenamiento de PINs temporales en Redis |
| `JwtTokenService` | Generación de tokens JWT con HMAC-SHA256 |
| `OrderCleanupService` | Background service que cancela órdenes pendientes mayores a 30 min |

## Diagrama de la base de datos

```
CUSTOMERS          ORDERS                ORDER_ITEMS
┌──────────┐      ┌──────────────┐      ┌───────────────┐
│ Id (PK)  │◄─────│ Id (PK)      │◄─────│ Id (PK)       │
│ Email    │      │ CustomerId   │      │ OrderId (FK)  │
│ CreatedAt│      │ TotalAmount  │      │ ProductName   │
└──────────┘      │ Status       │      │ UnitPrice     │
                  │ DatePurchase │      │ Quantity      │
                  │ MercadoPago  │      └───────────────┘
                  │   PreferenceId│
                  └──────────────┘
```
