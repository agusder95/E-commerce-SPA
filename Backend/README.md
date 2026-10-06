# Payment Gateway API

Backend de la aplicación de comercio electrónico. Es una API REST desarrollada con .NET 10 y organizada por capas. Gestiona autenticación por PIN, clientes, órdenes y pagos mediante Mercado Pago.

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Una cuenta de Mercado Pago para probar pagos y webhooks
- Un proveedor SMTP o una cuenta de Gmail con contraseña de aplicación
- [ngrok](https://ngrok.com/) para recibir webhooks durante el desarrollo local

## Estructura

```text
Backend/
└── PaymentGateway/
    ├── PaymentGateway.API            # Controllers, configuración y middleware
    ├── PaymentGateway.Application    # DTOs e interfaces
    ├── PaymentGateway.Domain         # Entidades y reglas del dominio
    ├── PaymentGateway.Infrastructure # Persistencia y servicios externos
    ├── compose.yaml
    └── PaymentGateway.sln
```

`Domain` no depende de otras capas. `Application` define contratos, `Infrastructure` los implementa y `API` expone la funcionalidad HTTP.

## Configuración local

Desde `Backend/PaymentGateway`, crear los archivos locales a partir de los ejemplos:

```bash
cp .env.example .env
cp PaymentGateway.API/appsettings.Development.example.json \
   PaymentGateway.API/appsettings.Development.json
```

Completar `appsettings.Development.json` con las cadenas de conexión, el token de Mercado Pago, una clave JWT de al menos 32 caracteres y la configuración SMTP. Los archivos locales están excluidos por Git. Nunca subir tokens, contraseñas ni claves privadas.

## Ejecutar la infraestructura

Desde `Backend/PaymentGateway`:

```bash
docker compose up -d sql-server-db redis-cache
```

Esto levanta SQL Server en `localhost:1433` y Redis en `localhost:6379`. Para detenerlos:

```bash
docker compose down
```

## Restaurar, migrar y ejecutar

```bash
dotnet restore
dotnet tool restore
dotnet ef migrations add InitialCreate \
  --project PaymentGateway.Infrastructure \
  --startup-project PaymentGateway.API
dotnet ef database update \
  --project PaymentGateway.Infrastructure \
  --startup-project PaymentGateway.API
dotnet run --project PaymentGateway.API
```

La API queda disponible en `http://localhost:5076` y Swagger en `http://localhost:5076/swagger`.

## Webhook de Mercado Pago

Para probar notificaciones desde una instalación local:

```bash
ngrok http 5076
```

Configurar la URL pública resultante como URL de notificación en `MercadoPagoService` y verificar que las URLs de retorno apunten al frontend local.

## Endpoints principales

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/request-access` | No | Envía un PIN por email |
| `POST` | `/api/auth/verify-access` | No | Valida el PIN y devuelve un JWT |
| `GET` | `/api/products` | No | Lista los productos |
| `GET` | `/api/products/{id}` | No | Obtiene un producto |
| `POST` | `/api/checkout/create-order` | JWT | Crea una orden y preferencia de pago |
| `POST` | `/api/checkout/webhook` | No | Recibe notificaciones de Mercado Pago |
| `GET` | `/api/order/{idOrder}` | No | Consulta una orden |
| `GET` | `/api/orders/my-purchases` | JWT | Lista las compras aprobadas |
| `GET` | `/api/orders/my-purchases-pending` | JWT | Lista compras pendientes o canceladas |

Para rutas protegidas:

```http
Authorization: Bearer <jwt>
```

Hay requests de ejemplo en `PaymentGateway.API/test.http`.

## Servicios principales

- `MercadoPagoService`: crea preferencias y consulta pagos.
- `SmtpEmailService`: envía los PIN por SMTP.
- `RedisCacheService`: almacena temporalmente los PIN.
- `JwtTokenService`: genera tokens JWT.
- `OrderCleanupService`: cancela órdenes pendientes antiguas.

## Comandos útiles

```bash
dotnet build
dotnet test
docker compose ps
```
