# Pruebas de seguridad y pagos — 20/10/2026

## Resultado

- **319 comprobaciones aprobadas** con PostgreSQL real en una base temporal y Redis real para el login por PIN.
- Servidor HTTP local temporal con los controladores, middleware de excepciones, autenticación JWT y autorización de ASP.NET Core.
- Compilación Release: **0 errores, 0 advertencias**.
- Auditoría NuGet, incluidas dependencias transitivas: **sin vulnerabilidades conocidas reportadas** al ejecutar la auditoría.
- Mercado Pago, SMTP y almacenamiento privado simulados. No se hicieron pagos, envíos SMTP ni descargas reales.
- La base temporal y las claves Redis con prefijo aleatorio exclusivo de la prueba fueron eliminadas al finalizar. No se modificaron los datos de la tienda.

## Cobertura principal

| Área | Comprobaciones |
|---|---|
| Login por PIN | Límites distribuidos por correo/IP, cinco errores y bloqueo de 15 minutos, reenvíos, vencimiento por TTL, HMAC, consumo único concurrente entre conexiones Redis, ocho verificaciones HTTP simultáneas con un solo JWT/cliente, rechazo de replay, roles desde PostgreSQL y fallos cerrados de Redis/SMTP. |
| JWT y autorización HTTP | Anónimos rechazados; tokens malformados, vencidos, con firma falsa, sin firma, con emisor/audiencia incorrectos o sin identidad; rol administrador falsificado; clientes sin permisos administrativos. |
| Aislamiento entre clientes | Otro cliente no puede consultar una orden, solicitar su conciliación ni generar una URL de descarga. |
| Entrada de checkout | JSON inválido, carrito nulo/vacío, ítems nulos y cantidades inválidas rechazados antes de generar preferencias. Identidad, estado y precios enviados por el cliente no reemplazan los valores del servidor. |
| Webhooks | HMAC válido e inválido, secreto equivocado, headers faltantes/ambiguos, modificación de `data.id`, discrepancia entre query y cuerpo. Firma inválida no llega al proveedor. |
| Confirmación del pago | ID, referencia, importe exacto y moneda verificados. Un pago pendiente no autoriza una compra. Parámetros del retorno del navegador no aprueban órdenes. |
| Descargas | Compra digital pendiente sin acceso; compra aprobada accesible sólo por su dueño; índices de archivo negativos/inexistentes rechazados. |
| Transacciones y stock | Fallo de preferencia revierte orden y reserva. Dos checkouts sobre la última unidad producen una aprobación de checkout y un 409, con una sola orden persistida. |
| Reintentos | Webhooks repetidos no descuentan stock ni duplican la confirmación pendiente. Cancelación, restauración y aprobación tardía conservan las reglas de stock. |
| Segundo plano | Reserva de 20 minutos, backoff persistido, límites por lote, coordinación entre conexiones, recuperación sin navegador, notificaciones de PostgreSQL y reconexión. Colas vacías sin consultas recurrentes durante 16 segundos. |

`HttpPaymentSecurityChecks.cs` agrega 37 comprobaciones a las 232 existentes; `PinLoginSecurityChecks.cs` agrega otras 50. Usa las mismas reglas JWT de producción mediante `JwtAuthentication.ValidationParameters`, no una autenticación ficticia que omita la validación de firmas.

## Fallos encontrados y corregidos

### Detalles internos expuestos en errores 500

La prueba provocó un fallo del proveedor con un mensaje interno identificable. El middleware devolvía ese mensaje en `Detailed` y la regresión falló. Se retiró ese campo de la respuesta pública; la excepción completa sigue registrándose del lado del servidor. La misma prueba pasa después de la corrección.

### Dependencias transitivas con aviso de seguridad

La auditoría detectó `NuGet.Packaging` y `NuGet.Protocol` 6.12.1, con severidad baja. Se fijaron ambas en **6.12.5**, dentro de la misma línea de versiones, y se repitieron restauración, pruebas, compilación y auditoría. La auditoría final no reporta paquetes vulnerables.

Referencia del mantenedor: [GHSA-g4vj-cjjj-v7hg](https://github.com/NuGet/NuGet.Client/security/advisories/GHSA-g4vj-cjjj-v7hg).

## Observaciones y límites

- Estas pruebas no comprueban que el `WebhookSecret` desplegado coincida con la aplicación real de Mercado Pago; usan claves de prueba. Un `SignatureMismatch` en el entorno real todavía requiere revisar esa configuración.
- Redis se ejercitó realmente con dos conexiones y claves aisladas. SMTP y los servicios externos se simularon; los fallos de conexión Redis en HTTP se inyectaron sin interrumpir el Redis compartido. No se hicieron pruebas de carga o de penetración sobre un despliegue público.
- Se cerró la observación anterior sobre el PIN: `RandomNumberGenerator` reemplaza a `Random`, Redis guarda una prueba HMAC y los scripts atómicos aplican cuotas, bloqueo y consumo único antes de acceder a clientes/JWT. La configuración y la consideración de proxies confiables están documentadas en `README.md`. Los códigos pendientes de la implementación anterior requieren solicitar un PIN nuevo.
- Frontend: `npm test` pasó los 19 archivos de prueba; `npm run build` pasó. `npm run lint` terminó sin errores, con 12 advertencias por imports sin usar en archivos ajenos al login (`EditorToolbar.jsx` y `ProductEditor.jsx`). No se hizo una nueva prueba de navegador del formulario en esta ronda.

## Reproducción

Desde la raíz del repositorio, con las conexiones PostgreSQL y Redis de desarrollo configuradas y permisos para crear/eliminar la base temporal:

```bash
dotnet restore Backend/PaymentGateway/PaymentGateway.sln
dotnet run --project Backend/PaymentGateway/PaymentGateway.SecurityChecks --no-restore -m:1 -- --database --redis
dotnet build Backend/PaymentGateway/PaymentGateway.sln -c Release --no-restore
dotnet list Backend/PaymentGateway/PaymentGateway.sln package --vulnerable --include-transitive --no-restore
```

No se inició ni se desplegó la API de la tienda como parte de esta validación.
