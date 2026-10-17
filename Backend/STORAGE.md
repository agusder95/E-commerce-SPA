# Productos, imágenes y archivos

El catálogo, los precios, las ofertas, los cupones, las órdenes y las estadísticas se leen de PostgreSQL. No se crean productos de ejemplo.

## Credenciales

Completar estas secciones en PaymentGateway/PaymentGateway.API/appsettings.Development.json. Ya están agregadas con placeholders. También pueden configurarse mediante variables de entorno con __ en lugar de :.

    "Cloudinary": {
      "CloudName": "tu-cloud-name",
      "ApiKey": "tu-api-key",
      "ApiSecret": "tu-api-secret"
    },
    "R2": {
      "AccountId": "tu-account-id",
      "AccessKeyId": "tu-access-key-id",
      "SecretAccessKey": "tu-secret-access-key",
      "BucketName": "tu-bucket-privado"
    },
    "Store": {
      "FrontendUrl": "http://localhost:5173",
      "WebhookUrl": "https://tu-api-publica/api/checkout/webhook"
    }

Cloudinary usa subidas autenticadas desde el backend; no necesita un upload preset sin firma. R2 usa un token S3 con permisos de lectura/escritura de objetos limitado al bucket elegido. Mantener deshabilitado el acceso público del bucket: las descargas usan enlaces firmados que vencen en diez minutos y se generan después de verificar usuario y pago aprobado. Como las subidas pasan por el backend, no hace falta CORS en R2.

Las credenciales nunca se envían al frontend. En el frontend, .env.local solamente necesita VITE_API_BASE_URL si la API no está en http://localhost:5076.

## Migración

Desde Backend/PaymentGateway:

    dotnet restore -m:1
    dotnet build -m:1
    dotnet ef database update --project PaymentGateway.Infrastructure --startup-project PaymentGateway.API --no-build

La fábrica EF lee la conexión de appsettings.Development.json; ConnectionStrings__DefaultConnection permite sobrescribirla. ProductFormatsAndFulfillment agrega dirección de entrega y una copia del tipo/archivo en cada ítem comprado. Normaliza los tipos digital/physical existentes y completa los ítems de compras ya aprobadas con los datos actuales del producto.

MultipleDigitalFiles agrega listas JSON de archivos a PRODUCTS y ORDER_ITEMS. Los productos y compras antiguos siguen usando su archivo original cuando no tienen lista; la migración no reemplaza datos existentes. Reiniciar la API después de compilar y aplicar migraciones.

CouponCreationDate agrega CreatedAt a COUPONS. Los cupones nuevos registran su creación; los anteriores conservan null porque no hay una fecha histórica registrada. Editar un cupón conserva su fecha de creación.

## Administración

La cuenta administradora debe tener rol ADMIN, Admin o admin en CUSTOMERS. Al cambiar el rol, volver a iniciar sesión para emitir un JWT nuevo.

En /admin/products hay tres secciones: Nuevo, Editar y Borrar.

- Elegir Físico, Digital o Ambas al crear o editar. Al crear, Ambas guarda dos registros en una transacción, con el mismo nombre y precios independientes; no crea un producto de tipo BOTH. Al editar una variante única y elegir Ambas, conserva su ID/tipo y crea la variante faltante. La variante original mantiene su oferta y las compras anteriores conservan sus referencias; la nueva no hereda descuentos.
- Si la contraparte del mismo nombre ya existe, incluso eliminada, la edición con Ambas devuelve conflicto sin guardar cambios. Editar la contraparte por separado o restaurarla desde Borrar. La comparación normaliza Unicode, mayúsculas y espacios. La transacción serializable evita duplicados al confirmar simultáneamente la misma conversión; un conflicto de concurrencia pide recargar y reintentar.
- Al pasar de Digital a Ambas, el precio actual se conserva como precio digital y debe ingresarse el precio físico. Al partir de Físico, se mantiene su precio/stock y debe completarse el precio digital y subir los archivos correspondientes.
- Cada variante tiene ID y precio propios. Las físicas tienen stock; las digitales requieren entre 1 y 50 archivos.
- Subir la galería a Cloudinary mediante arrastre, selección de archivos o importación de una URL pública HTTPS. Los archivos locales pueden ser JPG, PNG, WebP o GIF de hasta 10 MB. La primera imagen se asigna como miniatura; puede seleccionarse otra desde la galería.
- Seleccionar uno o varios archivos digitales para subir a R2 (hasta 100 MB por archivo). Pueden agregarse más archivos o quitarse del formulario antes de confirmar. Quitar una referencia no borra el objeto de R2 ni modifica compras anteriores.
- Hacer clic en el nombre de un archivo cargado abre su vista previa en una nueva pestaña. Los PDF se muestran en el visor del navegador mediante un enlace firmado de diez minutos; `/api/admin/assets/digital-preview?key=...` requiere rol administrador y funciona también antes de guardar el producto.
- La descripción se edita con Lexical: párrafos, saltos de línea, negrita, cursiva, subrayado, listas numeradas/con viñetas, listas anidadas, sangrías y alineación. Se guarda como JSON en Description; las descripciones antiguas de texto plano siguen mostrándose y pueden editarse. La tienda renderiza sólo nodos y formatos permitidos, sin interpretar HTML arbitrario.
- Guardar el producto; los metadatos y las referencias a los archivos quedan en PostgreSQL.
- Editar lista únicamente los productos actuales; elegir uno abre sus datos existentes.
- Borrar permite filtrar Actuales/Eliminados y seleccionar múltiples productos para eliminar o restaurar. El modal muestra los nombres y tipos antes de confirmar. La eliminación es lógica y conserva el historial de compras y los archivos.
- Las listas pueden ordenarse alfabéticamente, por más nuevos o por más viejos.
- Crear y guardar cambios también requieren confirmación mediante modal.
- Los tags seleccionables se leen de TAGS. Físico y Digital se asignan automáticamente según la variante y no pueden seleccionarse ni crearse manualmente.
- Crear tags requiere confirmación. Se normalizan a Unicode NFC, se quitan espacios extremos y se guardan con primera letra mayúscula y resto minúscula, conservando acentos; máximo 15 caracteres. La API y un índice único calculado en PostgreSQL impiden duplicados sin distinguir mayúsculas ni acentos (Diseño/diseno).
- DatabaseTagsAndProductVariants incorpora los tags automáticos, consolida duplicados equivalentes y conserva las asociaciones existentes almacenadas como nombres en el JSON de PRODUCTS.Tags. Los nombres antiguos de hasta 50 caracteres se preservan por compatibilidad; los tags nuevos tienen límite de 15.

En /admin/offers hay dos secciones: Ofertas y Cupones. Ofertas permite seleccionar productos, filtrar por tags, ordenar y simular precios antes de guardar o eliminar descuentos por lote. El porcentaje se calcula sobre el precio original, admite de 1 a 99 con hasta dos decimales y reemplaza la oferta anterior. La expiración de la oferta es obligatoria. Los cambios por lote requieren confirmación y se validan también en el backend.

Los cupones se crean y editan con códigos normalizados en mayúsculas y sin tildes. Su porcentaje admite de 1 a 99 con hasta dos decimales; la expiración es opcional. Pueden limitarse por tipo y/o tags: deben coincidir con el tipo elegido y con al menos uno de los tags seleccionados. Sin restricciones son globales. En checkout sólo se descuentan los ítems elegibles; si no hay ninguno, se rechaza el cupón. La lista filtra activos, vencidos, inactivos o todos y ordena por expiración o creación. Las fechas de administración se cargan y muestran como dd/mm/yyyy; los vencimientos se guardan como UTC al final del día elegido en el navegador.

Las imágenes/archivos ya subidos se conservan si se cancela el formulario; su limpieza se realiza desde el proveedor cuando corresponda.

## Checkout y entregas

El servidor obtiene el cliente desde el JWT y recalcula precios/descuentos desde PostgreSQL. No confía en el precio ni el nombre enviado desde el navegador. Reserva stock físico dentro de una transacción; al rechazar/cancelar una orden libera esa reserva.

Los productos físicos se entregan de manera presencial. El checkout no solicita ni envía dirección y el servidor no la exige para crear una orden. Las direcciones de órdenes anteriores se conservan como datos históricos; no hay integración con transportistas ni cálculo automático de tarifas de envío.

La compra digital se descarga desde /my-purchases después de que el webhook confirme el pago, con un botón por archivo. Se guarda una copia de los nombres y claves de todos los archivos comprados para que una edición posterior del producto no cambie los archivos entregados a compras anteriores. El endpoint /api/orders/items/{id}/download?file={índice} verifica comprador y pago; sin índice descarga el primer archivo por compatibilidad. Las respuestas de compras exponen índices y nombres, no claves privadas de R2.

Documentación de proveedores:

- https://cloudinary.com/documentation/upload_images
- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-net/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
