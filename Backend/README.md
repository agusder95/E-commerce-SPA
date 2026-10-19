# Payment Gateway API

Backend de la aplicación de comercio electrónico. Es una API REST desarrollada con .NET 10 y organizada por capas. Gestiona autenticación por PIN, clientes, órdenes y pagos mediante Mercado Pago.

Para configurar productos físicos/digitales, Cloudinary y Cloudflare R2, seguir [STORAGE.md](STORAGE.md).

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

La clave del token es `MercadoPago:AccessToken` (con dos letras s en Access), o `MercadoPago__AccessToken` como variable de entorno. En Development se utilizan las credenciales de prueba. La antigua clave `AccesToken` se acepta por compatibilidad únicamente si `AccessToken` no está definida. Si el token falta o está vacío, la API detiene el arranque con un error de configuración; no se aprueban pagos de forma local.

En `.env`, definir `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_PORT` (5432 por defecto). Si el puerto está ocupado, elegir otro y usarlo también en la conexión local:

```text
Host=localhost;Port=5432;Database=Order_Customer;Username=paymentgateway;Password=<tu-contraseña>;
```

La API ejecutada con Docker usa `Host=postgres-db`. Las fechas se almacenan como `timestamp with time zone`; usar valores UTC al guardar fechas desde .NET.

## Ejecutar la infraestructura

Desde `Backend/PaymentGateway`:

```bash
docker compose up -d postgres-db redis-cache
```

Esto levanta PostgreSQL 17 en `localhost:5432` y Redis en `localhost:6379` por defecto. Se pueden cambiar los puertos publicados con `POSTGRES_PORT` y `REDIS_PORT` en `.env`; actualizar también las conexiones locales en `appsettings.Development.json`. Para detenerlos:

```bash
docker compose down
```

## Restaurar, migrar y ejecutar

```bash
dotnet restore
dotnet tool restore
export ConnectionStrings__DefaultConnection='Host=localhost;Port=5432;Database=Order_Customer;Username=paymentgateway;Password=<tu-contraseña>;'
dotnet ef database update \
  --project PaymentGateway.Infrastructure \
  --startup-project PaymentGateway.API
dotnet run --project PaymentGateway.API
```

La API queda disponible en `http://localhost:5076` y Swagger en `http://localhost:5076/swagger`.

Las migraciones de PostgreSQL están incluidas en el repositorio: `database update` crea las nueve tablas de negocio: `CUSTOMERS`, `PRODUCTS`, `ORDERS`, `ORDER_ITEMS`, `COUPONS`, `DAILY_PRODUCT_SALES`, `DAILY_SALES` `TAGS` y `PRODUCT_PRICE_HISTORY`. EF mantiene además `__EFMigrationsHistory` (diez tablas en total). La base comienza vacía; no se importan datos de SQL Server. El catálogo necesita productos cargados para poder probar compras.

`CompleteOriginalSchema` completa las tablas y columnas que no estaban representadas en el modelo inicial. Conserva la unicidad de códigos de cupón, nombres de etiquetas, fecha de venta diaria y combinación fecha/producto. La tabla de ventas por producto se llama `DAILY_PRODUCT_SALES`, en plural, igual que en SQL Server.

Para futuras modificaciones del modelo:

```bash
dotnet ef migrations add NombreDelCambio \
  --project PaymentGateway.Infrastructure \
  --startup-project PaymentGateway.API
```

La fábrica de contexto para migraciones lee `ConnectionStrings__DefaultConnection`; no necesita iniciar los servicios de Mercado Pago, SMTP ni Redis.

## Webhook de Mercado Pago

Para probar notificaciones desde una instalación local:

```bash
ngrok http 5076
```

Configurar `Store:WebhookUrl` con `https://<tu-túnel>/api/checkout/webhook` y `Store:FrontendUrl` con la URL del frontend. En **Tus integraciones → Webhooks** de Mercado Pago, configurar esa misma URL para eventos de pagos y copiar la clave secreta en `MercadoPago:WebhookSecret` (o `MercadoPago__WebhookSecret`). Es una clave distinta del `AccessToken`; también se exige en Development. No compartirla ni subirla al repositorio.

Sin esa clave, crear órdenes y recibir notificaciones de pagos devuelve **503**, sin reservar stock ni generar preferencias. El checkout también valida `Store:WebhookUrl` antes de acceder a la base: una URL faltante, sin HTTPS o que apunte a localhost devuelve **503** con un mensaje de configuración, en lugar de fallar después de insertar la orden. Si cambia la dirección del túnel, actualizar `Store:WebhookUrl` y mantener ngrok abierto durante las pruebas. El resto de la API puede funcionar. El webhook valida `x-signature`, `x-request-id` y el parámetro de query `data.id` con el SDK oficial; el ID del cuerpo debe coincidir. Luego consulta el pago mediante el token del servidor y verifica ID, referencia interna, importe exacto (`transaction_amount`) y moneda **ARS** contra la orden guardada, antes de modificar su estado o stock. Nunca se aprueba una compra por los parámetros de retorno del navegador.

Firma inválida: **401**; ID/cuerpo inconsistente: **400**; importe/moneda incorrectos u orden sin preferencia: **409**; respuesta del proveedor inconsistente: **502**; proveedor no disponible: **503**. Los errores no confirman recepción a Mercado Pago y permiten sus reintentos. Las notificaciones repetidas de órdenes ya aprobadas no vuelven a descontar stock. No se impone una ventana de antigüedad a la firma: los reintentos consultan el estado actual del pago. Reembolsos, contracargos y pagos divididos requieren un flujo adicional de conciliación y no forman parte de esta validación.

### Pago aprobado que sigue pendiente

Revisar el historial de ngrok en `http://localhost:4040`: **401** indica una firma rechazada (la consola informa el motivo, sin exponer claves). Copiar `WebhookSecret` desde la misma aplicación de Mercado Pago que corresponde al AccessToken, guardar y reiniciar la API. Si el proveedor informa `live_mode: true`, verificar la configuración de esa aplicación/modo, no asumir que usa la clave de prueba. **404** en `/` significa que la URL del panel quedó incompleta: debe terminar en `/api/checkout/webhook`. El retorno del navegador y los eventos IPN antiguos `?topic=payment&id=...` no sustituyen un webhook firmado.

El backend registra `PaymentReconciliationWorker`: al arrancar y cada 15 segundos recorre las órdenes con preferencia aún sin resolver, consulta sus pagos en Mercado Pago y aplica la confirmación. **No depende del navegador**: sigue funcionando al ir a `/home`, cerrar la pestaña o cerrar sesión. Retoma las órdenes persistidas después de reiniciar la API; mientras la API está apagada no puede consultar. Un ciclo no se solapa con el anterior, y un error en una orden no bloquea las siguientes. También revisa rechazadas/canceladas para detectar pagos tardíos: recupera stock si está disponible o deja la compra en revisión. Las órdenes ya pagadas no vuelven a descontar stock ni a generar el correo de confirmación.

La pantalla de resultado también ejecuta `POST /api/checkout/orders/{orderId}/sync-payment` con JWT inmediatamente y cada 15 segundos mientras espera, sólo como consulta adicional. No necesita cuerpo: el backend busca el pago por la preferencia guardada y la referencia de la orden; no acepta IDs ni estados de pago del navegador. Sólo el dueño de la orden puede solicitarlo; la respuesta oficial debe coincidir con la orden, el importe y ARS antes de usar `PaymentReconciliationService`, compartido con el webhook y el worker. La recuperación devuelve **204** si se completó la consulta (incluso si todavía no hubo pago), **404** si la orden no pertenece al usuario y **409** si el pago no corresponde. No desactiva ni relaja la verificación de firma de notificaciones públicas.

El barrido actual prioriza no dejar órdenes antiguas sin verificar y no agrega una caducidad artificial. Si aumenta mucho el volumen de órdenes no resueltas, reemplazar el barrido por una cola persistida con backoff para respetar los límites del proveedor. El webhook sigue siendo el canal principal de confirmación inmediata.

Comprobaciones de seguridad sin pagos reales:

```bash
dotnet run --project PaymentGateway.SecurityChecks
# Opcional: integración PostgreSQL en una base temporal que se crea y elimina.
dotnet run --project PaymentGateway.SecurityChecks -- --database
```

La segunda opción lee la conexión local de `PaymentGateway.API/appsettings.Development.json` (o `ConnectionStrings__DefaultConnection`) y necesita permisos para crear y eliminar una base temporal; no modifica la base configurada.

## Endpoints principales

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/request-access` | No | Envía un PIN por email |
| `POST` | `/api/auth/verify-access` | No | Valida el PIN y devuelve un JWT |
| `GET` | `/api/products` | No | Lista los productos |
| `GET` | `/api/products/{id}` | No | Obtiene un producto |
| `POST` | `/api/checkout/create-order` | JWT | Crea una orden y preferencia de pago |
| `POST` | `/api/checkout/validate-coupon` | JWT | Valida un único cupón y calcula descuentos sin crear órdenes ni reservar stock |
| `POST` | `/api/checkout/webhook` | No | Recibe notificaciones de Mercado Pago |
| `POST` | `/api/checkout/orders/{orderId}/sync-payment` | JWT | Reconcilia el pago consultando al proveedor |
| `GET` | `/api/admin/statistics/products/{id}/sales?from=2026-10-01&to=2026-10-31&groupBy=day` | Admin | Unidades e importe vendido por producto y período |
| `GET` | `/api/admin/statistics/products/{id}/prices?from=2026-10-01&to=2026-10-31` | Admin | Intervalos de precios de lista y ofertas |
| `GET` | `/api/admin/orders` | Admin | Lista órdenes con detalle de productos, descuentos y cupón |
| `POST` | `/api/admin/tags/delete` | Admin | Elimina los tags seleccionados y los quita de productos actuales y borrados; protege Físico y Digital |
| `POST` | `/api/admin/orders/{id}/cancel` | Admin | Cancela una orden y libera el stock reservado; no realiza reembolsos |
| `POST` | `/api/admin/orders/{id}/restore` | Admin | Recupera el estado anterior y valida el stock antes de reservarlo |
| `GET` | `/api/order/{idOrder}` | JWT | Consulta una orden propia |
| `GET` | `/api/orders/my-purchases` | JWT | Lista las compras aprobadas |
| `GET` | `/api/orders/my-purchases-pending` | JWT | Lista compras pendientes o canceladas |

Para rutas protegidas:

```http
Authorization: Bearer <jwt>
```

Hay requests de ejemplo en `PaymentGateway.API/test.http`.

## Estadísticas por producto

Las rutas de estadísticas requieren rol administrador y consultan un `IdProduct` individual; las versiones física y digital se mantienen separadas. También admiten productos eliminados. `from` y `to` son obligatorios, incluyen ambos días y usan fechas de Argentina (UTC−03); el rango máximo es de 3660 días. Los importes están expresados en ARS, después de ofertas y cupones y antes de comisiones.

`GET /api/admin/statistics/products/{id}/sales` acepta `groupBy=day|week|month` (por defecto `day`). Cuenta únicamente órdenes actualmente `APPROVED`, sin cancelación manual, según `Order.ApprovedAt`, obtenido del `date_approved` autenticado de Mercado Pago y almacenado en UTC. Devuelve `quantity`, `revenue`, `averageUnitPrice` y `periods`, con cantidad, importe, promedio ponderado por unidades, precio mínimo y máximo en cada período. Los períodos sin ventas tienen cantidad e importe cero y precios nulos. Las semanas comienzan el lunes; `periodStart` indica el inicio calendario de la semana o mes, aunque el filtro comience después. Solo se suman ventas dentro del rango solicitado.

Las órdenes antiguas carecen de fecha de aprobación: no se usa la creación de la orden ni la recepción del webhook como sustituto. `excludedOrdersWithoutApprovalDate` informa la cantidad total de órdenes aprobadas del producto sin esa fecha, sin asignarlas artificialmente a ningún período. Una reconciliación posterior con información oficial puede completar el dato sin modificar fechas ya registradas. Las órdenes pendientes, canceladas y `PAID_REQUIRES_REVIEW` quedan fuera del informe, igual que en el dashboard actual. Estos importes representan ventas registradas; no son un registro fiscal ni un libro de reembolsos del proveedor.

`GET /api/admin/statistics/products/{id}/prices` devuelve `periods` con `from`, `to` (exclusivo), `listPrice`, `offerPrice`, `effectivePrice` y `reason`. Los instantes se expresan en UTC. El historial se registra en la misma operación de guardado que el producto, incluyendo ofertas masivas, cambios de vencimiento y retiro de ofertas. Un vencimiento divide el intervalo y restablece el precio de lista, sin necesitar una venta ni un proceso programado. El precio publicado excluye cupones, cuyos efectos se reflejan en los precios efectivamente vendidos del endpoint de ventas.

La migración `ProductSalesStatistics` crea una observación inicial (`INITIAL_SNAPSHOT`) de los precios existentes en el momento de ejecutarse. No reconstruye precios anteriores. `coverageStartsAt` y `hasUnknownPrices` permiten identificar períodos sin historial conocido. Las nuevas compras guardan `BeforeCouponUnitPrice`; `ProductDiscount` y `DiscountApplied` guardan, respectivamente, los descuentos unitarios de oferta y cupón. En las compras anteriores, `BeforeCouponUnitPrice` queda nulo porque no es posible separar ambos descuentos con certeza.

Aplicar la migración con `dotnet ef database update --project PaymentGateway.Infrastructure --startup-project PaymentGateway.API` desde `Backend/PaymentGateway`. Las comprobaciones `PaymentGateway.SecurityChecks -- --database` verifican la migración sobre un esquema anterior, fechas de aprobación, límites de días locales, agregaciones y vencimientos de ofertas en una base temporal.

## Resumen de la tienda

`GET /api/admin/dashboard?from=AAAA-MM-DD&to=AAAA-MM-DD` requiere administrador y filtra por fecha de aprobación del pago en Argentina, incluyendo ambos días. Sin fechas consulta hoy. Rechaza rangos incompletos, invertidos, futuros o mayores de 3660 días. Excluye pendientes, canceladas y pagos sin fecha de aprobación conocida; informa estos últimos por separado.

Devuelve importe vendido, compras aprobadas, unidades vendidas, promedio por compra y cantidad actual de productos activos. `topProducts` contiene hasta tres productos con más unidades vendidas, incluidos productos eliminados que tengan ventas. `leastSoldProducts` contiene hasta tres productos actualmente activos, creados antes del final del período, incluyendo los que no tuvieron ventas. Se ordenan por unidades vendidas divididas por días calendario desde el inicio del período o su creación, lo que sea posterior. Ante igualdad se priorizan menos unidades y mayor tiempo disponible. Los formatos físicos y digitales se cuentan por separado. No se reconstruye la disponibilidad histórica de productos eliminados/restaurados.

## Servicios principales

- `MercadoPagoService`: crea preferencias y consulta pagos.
- `SmtpEmailService`: envía los PIN y las confirmaciones de compra por SMTP.
- `PurchaseEmailService`: procesa cada 15 segundos las confirmaciones pendientes de pagos verificados, registra el envío y reintenta los fallos de SMTP. Las órdenes anteriores a la migración no generan correos retroactivos.
- `RedisCacheService`: almacena temporalmente los PIN.
- `JwtTokenService`: genera tokens JWT.
- `OrderCleanupService`: cancela órdenes pendientes antiguas.

## Comandos útiles

Las confirmaciones incluyen productos, cantidades, importes y un enlace a `/my-purchases` en `Store:FrontendUrl` (usá la URL pública de la tienda al publicar). Si hay productos físicos, indican entrega presencial y enlazan a la cuenta configurada en `Store:InstagramUrl`, actualmente `https://www.instagram.com/brandoni.andrea/`. Sin sesión, el enlace abre el login y regresa a Mis compras después de verificar el PIN.

Aplicá la migración `PurchaseConfirmationEmails` antes de iniciar la API actualizada:

```bash
dotnet ef database update --project PaymentGateway.Infrastructure --startup-project PaymentGateway.API
```

```bash
dotnet build
dotnet test
docker compose ps
```
