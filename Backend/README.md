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

Los webhooks son la vía principal de confirmación. `PaymentReconciliationWorker` funciona como respaldo y selecciona como máximo 50 órdenes cuya `NextPaymentCheckAt` ya llegó. **No depende del navegador ni de una sesión abierta.** La próxima consulta, el último intento, su contador y el ID de pago verificado quedan persistidos. Los intervalos crecen de 30 a 60, 120, 240 y 300 segundos; los errores aumentan la espera, con el mismo máximo. Las órdenes aprobadas o en revisión salen de la cola. Los pagos en proceso reutilizan su ID, evitando buscar nuevamente la preferencia.

La reserva de una orden nueva y su preferencia vencen a los **20 minutos**, usando el mismo `ExpiresAt`. La limpieza espera el próximo vencimiento y comparte la conciliación: antes de liberar una reserva sin pago hace una última consulta al proveedor. Una respuesta de pago en proceso conserva la reserva; una caída del proveedor posterga la liberación hasta poder verificar. Por eso los 20 minutos no garantizan liberación exacta durante una caída o con pagos en proceso. Las reservas sin preferencia pueden liberarse directamente. Una reserva sin pago se sigue revisando si el proveedor continúa caído, para poder resolverla al recuperarse.

**Sin trabajo no hay consultas periódicas a la base.** Pagos, reservas y correos hacen una lectura inicial y duermen hasta la próxima fecha pendiente o una notificación de PostgreSQL. `PostgresOrderWorkListener` mantiene una conexión dedicada con `LISTEN`, sin ejecutar consultas SQL de sondeo ni keepalive SQL. La migración `OrderWorkNotifications` crea un trigger que notifica cambios de estado, planificación, preferencia, vencimiento o correo pendiente después del commit. Un rollback y las modificaciones ajenas a esas colas no las despiertan. Cada instancia recibe el evento; los bloqueos existentes coordinan el procesamiento. Al reconectar se vuelven a leer las colas para recuperar eventos perdidos. El número de revisión de la señal evita perder un commit entre leer la cola y comenzar a esperar.

`WorkerIntervalSeconds` y `CleanupIntervalSeconds` quedan como esperas mínimas de reintento de trabajos vencidos/bloqueados, no como temporizadores permanentes. Las fallas de base usan espera creciente hasta cinco minutos. Los correos fallidos mantienen su reintento de 15 segundos mientras haya correos pendientes. Aplicá `OrderWorkNotifications` antes de reiniciar la API; el listener valida el trigger al arrancar para evitar quedar dormido sin recibir eventos. Las comprobaciones de PostgreSQL cuentan las sentencias de las tres tareas durante 16 segundos sin trabajo y verifican cero consultas, despertar entre conexiones y recuperación después de reconectar.

Rechazadas, canceladas y pagos en proceso tienen una ventana de consultas automáticas de 24 horas después del vencimiento. Terminado ese plazo salen de la cola; los pagos que siguen en proceso conservan su estado y stock y deben revisarse operativamente si no llega una notificación. Los webhooks autenticados siguen funcionando después de ese plazo: un pago tardío recupera stock disponible o deja la compra en revisión. La cancelación local no cancela un cobro que ya esté procesando Mercado Pago.

El webhook, la conciliación, la limpieza y las acciones administrativas coordinan cada orden mediante un bloqueo de sesión de PostgreSQL. Esto evita búsquedas simultáneas desde distintas instancias y mantiene las transacciones fuera de las esperas de red. Si una notificación llega mientras la orden está bloqueada, recibe 503 para que se reintente. La planificación se guarda antes de consultar al proveedor para respetar la espera también después de reiniciar la API. Las aprobaciones repetidas no descuentan stock ni envían correos dos veces.

Los valores están en la sección `PaymentTracking` de `appsettings.json` y pueden sobreescribirse con variables como `PaymentTracking__ReservationMinutes`. Se validan al iniciar. El meter `PaymentGateway.Payments` expone `payment.provider.requests`, `payment.provider.failures` y `payment.provider.duration` (milisegundos), con la operación `search`, `verify` o `create_preference`. Los registros de conciliación incluyen orden, resultado, intento y próxima consulta; el worker registra las órdenes que terminan su ventana de seguimiento.

Aplicá `PaymentTrackingSchedule` antes de iniciar esta versión. La migración conserva los 30 minutos de las preferencias emitidas anteriormente y programa la recuperación de órdenes pendientes existentes. Las canceladas/rechazadas históricas fuera de la ventana no reinician consultas. Las pruebas `PaymentGateway.SecurityChecks -- --database` verifican esta actualización, los intervalos, el límite por lote, la coordinación entre conexiones, los pagos tardíos y la liberación única de stock.

El frontend comparte el seguimiento del carrito y la pantalla de resultado y consulta únicamente `GET /api/order/{id}` con intervalos crecientes (3 a 30 segundos), pausando al ocultar la pestaña o perder conexión. Este endpoint filtra por usuario en PostgreSQL, devuelve un resumen sin ítems e incluye `expiresAt` para evitar reabrir preferencias vencidas. No llama al proveedor. El cierre de sesión detiene las solicitudes del navegador y deja funcionando el proceso del servidor.

`POST /api/checkout/orders/{orderId}/sync-payment` permanece disponible como recuperación autenticada y respeta la misma planificación persistida: una petición adelantada devuelve **204** sin consultar Mercado Pago. No acepta IDs ni estados de pago del navegador. Sólo el dueño puede solicitarlo; devuelve **204** al completar o diferir, **404** si no le pertenece y **409** si el pago no coincide con referencia, importe y moneda. El frontend ya no lo ejecuta periódicamente. La autenticación de este endpoint no reemplaza la firma de los webhooks públicos.

Comprobaciones de seguridad sin pagos reales:

El [informe de seguridad y pagos](SECURITY-PAYMENTS-TEST-REPORT.md) detalla la cobertura, los hallazgos y los límites de la validación. La variante con `--database` también inicia un servidor HTTP local temporal para probar JWT, roles, aislamiento de clientes, firmas de webhook y descargas con el middleware real.

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
| `PATCH` | `/api/admin/products/stock` | Admin | Actualiza solo stock físico en un lote atómico de hasta 500 entradas `{ idProduct, expectedStock, stock }` dentro de `{ items: [...] }`; devuelve 409 si un stock cambió o el producto no está disponible |
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

## Login por PIN

Los códigos contienen seis dígitos generados con `RandomNumberGenerator`. Vencen en **5 minutos** y sólo pueden usarse una vez: la verificación y eliminación se ejecutan en una operación atómica de Redis, antes de consultar/crear el cliente o emitir el JWT. Un reenvío reemplaza el código anterior. Redis guarda una prueba HMAC ligada al correo normalizado y a un identificador aleatorio de desafío; no guarda el PIN en texto plano. La clave HMAC se deriva con un contexto propio de `JwtSettings:SecretKey`, que debe tener al menos 32 bytes y ser idéntica entre instancias. Rotar esa clave invalida los PIN pendientes y los JWT existentes.

Los valores de `PinLogin` en `PaymentGateway.API/appsettings.json` controlan:

| Control | Valor inicial |
|---|---|
| Vigencia | 300 segundos |
| Espera entre envíos al mismo correo | 60 segundos |
| Intentos incorrectos por desafío | 5 |
| Bloqueo del correo tras agotar intentos | 900 segundos |
| Ventana de límites | 900 segundos desde la primera operación |
| Envíos por correo / IP en la ventana | 5 / 20 |
| Verificaciones por correo / IP en la ventana | 20 / 100 |

Los límites se comparten entre instancias y sobreviven a reinicios de la API mientras Redis conserve sus datos. Cambiar mayúsculas o IP no elimina el límite del correo. También se cuentan verificaciones de códigos inexistentes. Durante un bloqueo no se puede enviar otro PIN para reiniciar los intentos. Un error de SMTP revoca sólo su propio desafío y libera la espera de reenvío, pero conserva los presupuestos de solicitudes. Si Redis falla se devuelve **503**; el login no permite continuar sin verificación.

**429** devuelve `Retry-After`, `code: PIN_RATE_LIMITED` y `retryAfterSeconds`. **503** devuelve `code: PIN_UNAVAILABLE`, sin detalles internos. La solicitud exitosa informa `expiresInSeconds` y `resendAfterSeconds`. El frontend usa este último y muestra los mensajes del servidor. Las respuestas del login llevan `Cache-Control: no-store`.

La IP se toma de la conexión. El código no confía directamente en `X-Forwarded-For`. Si hay un proxy delante, configurar explícitamente los proxies/redes confiables con el middleware de ASP.NET Core antes de usar direcciones reenviadas; de lo contrario, todos sus clientes compartirán el límite de la IP del proxy. Todas las instancias deben usar el mismo Redis, prefijo `PinLogin:RedisKeyPrefix` y políticas. Las claves usan TTL y un mismo hash slot para permitir scripts atómicos en Redis Cluster. Redis debe ser privado, autenticado y accesible sólo por servicios autorizados.

No requiere migración de PostgreSQL. Al actualizar, los PIN emitidos por la implementación anterior dejan de aceptarse y debe solicitarse uno nuevo. Reiniciar la API y publicar el frontend actualizado para activar los cambios.

Pruebas con Redis real, servidor HTTP temporal y PostgreSQL temporal, sin SMTP externo:

```bash
dotnet run --project Backend/PaymentGateway/PaymentGateway.SecurityChecks --no-restore -m:1 -- --database --redis
```

Se requiere `ConnectionStrings:RedisConnection` además de la conexión PostgreSQL de desarrollo. Las pruebas sólo eliminan claves de su prefijo aleatorio; no ejecutan `FLUSHDB`.

## Servicios principales

- `MercadoPagoService`: crea preferencias y consulta pagos.
- `SmtpEmailService`: envía los PIN y las confirmaciones de compra por SMTP.
- `PurchaseEmailService`: despierta al recibir confirmaciones pendientes de pagos verificados, registra el envío y reintenta los fallos de SMTP cada 15 segundos mientras haya trabajo. Sin correos pendientes espera notificaciones de la base. Las órdenes anteriores a la migración no generan correos retroactivos.
- `RedisPinChallengeStore`: guarda pruebas HMAC de los PIN y aplica consumo único, límites y bloqueos mediante scripts atómicos de Redis.
- `JwtTokenService`: genera tokens JWT.
- `OrderCleanupService`: cancela órdenes pendientes antiguas.

## Comandos útiles

Las confirmaciones incluyen productos, cantidades, importes y un enlace a `/my-purchases` en `Store:FrontendUrl` (usá la URL pública de la tienda al publicar). Si hay productos físicos, indican entrega presencial y enlazan a la cuenta configurada en `Store:InstagramUrl`, actualmente `https://www.instagram.com/brandoni.andrea/`. Sin sesión, el enlace abre el login y regresa a Mis compras después de verificar el PIN.

Aplicá las migraciones pendientes, incluidas `PaymentTrackingSchedule` y `OrderWorkNotifications`, antes de iniciar la API actualizada:

```bash
dotnet ef database update --project PaymentGateway.Infrastructure --startup-project PaymentGateway.API
```

```bash
dotnet build
dotnet test
docker compose ps
```
