# Arquitectura del frontend

El código está organizado por funcionalidades. La composición mantiene el almacenamiento de sesión y no incorpora datos de ejemplo al catálogo. Lexical se utiliza únicamente en la edición de descripciones.

```text
src/
├── app/                 # Composición, proveedores, rutas y layout de la tienda
├── features/
│   ├── about/
│   ├── auth/            # Acceso por email/PIN y contexto de sesión
│   ├── cart/            # Carrito y preparación del checkout
│   ├── catalog/         # Catálogo, detalle y adaptación del DTO de productos
│   ├── orders/          # Compras, descargas y seguimiento de pago
│   └── admin/           # Dashboard, compras, cupones y administración
│       └── products/    # Editor, listado, tags, archivos y confirmaciones
├── shared/
│   ├── api/             # Transporte HTTP, JWT y errores de la API
│   ├── hooks/           # Consultas reutilizables con cancelación
│   ├── rich-text/       # Editor Lexical, validación y lectura segura de descripciones
│   ├── ui/              # Modales, feedback y botones de secciones
│   └── utils/           # Formatos compartidos
└── assets/
```

## Responsabilidades

- `app`: ensambla funcionalidades. `AppProviders` mantiene sesión y carrito por fuera de las páginas para conservarlos al navegar. `AppRoutes` carga las páginas mediante `lazy` y `Suspense`; `StoreLayout` organiza navegación, contenido y footer.
- `pages`: conectan hooks y componentes. No realizan solicitudes HTTP directamente.
- `components`: renderizan interfaz mediante props y callbacks. No importan las APIs. El estado local de foco, pegado y edición de dígitos queda en `PinInput`.
- `hooks`: coordinan estado y acciones del caso de uso. `usePinAuth`, `useAdminProducts`, `useProductMedia`, `useCheckout`, `usePurchases` y `useCheckoutResult` aíslan los flujos de la presentación.
- `api`: funciones específicas por dominio; utilizan únicamente el cliente HTTP compartido. No contienen JSX ni estado de React.
- `model`: funciones puras para adaptar datos, validar tags, preparar payloads, ordenar productos y representar estados de pago. Pueden probarse sin navegador.
- `shared`: infraestructura y controles independientes de una funcionalidad. La navegación global, que depende de autenticación y carrito, pertenece a `app/layout`.

La dirección de uso es `página → hook → API → cliente HTTP`. La página compone componentes; los modelos no dependen de React. No se usan contextos para formularios locales: sólo sesión y carrito son globales.

## Ejemplo: administración de productos

`AdminProducts` compone `ProductManagementList`, `ProductEditor` y `ProductConfirmation`. El editor compone `ProductTags` y `ProductMedia`. `useAdminProducts` coordina crear/editar/eliminar/restaurar y los tags; `useProductMedia` se encarga de importar/subir archivos, galería y miniatura. Las reglas de tags y los payloads están en `model/productForm.js`.

El selector ofrece Físico, Digital y Ambas tanto en Nuevo como en Editar. `changeProductType` adapta los campos de precio sin perder archivos ni stock por cambios temporales de selección. En edición, Ambas conserva el producto original y crea sólo la contraparte faltante mediante una operación atómica del backend; el modal identifica qué variante se actualiza y cuál se crea. Las contrapartes existentes no se sobrescriben: se editan/restauran por separado.

`RichTextEditor` encapsula Lexical y sincroniza el documento JSON con el formulario; `EditorToolbar` contiene los comandos de formato. `readRichText` valida estructura, profundidad y formatos permitidos. `RichTextContent` presenta el documento en el catálogo sin cargar el editor ni insertar HTML; conserva la compatibilidad con texto plano. Los archivos digitales se manejan como una colección de claves/nombres en administración, y como índices/nombres para descargar compras aprobadas.

## Catálogo y galería

`Products` compone el hero, dos instancias de `ProductCarousel` y la grilla paginada. `/` y `/home` muestran la misma vista. `useCatalog` coordina filtros y paginación; `model/catalog.js` agrupa variantes por nombre, calcula los destacados y limita la página a seis cards. Los nombres se comparan normalizando Unicode, espacios y mayúsculas, sin confundir nombres con acentos distintos. El precio de una card es el menor precio vigente entre sus variantes; el aviso de descuento contempla cualquiera de ellas.

Nuevos incluye hasta cinco familias con una variante creada hace menos de 14 días; Colecciones incluye hasta cinco familias según la fecha de sus variantes con ese tag. Los tags de Todos se combinan con AND sobre los tags de la familia, hasta dos a la vez. Cambiar búsqueda, orden o tags reinicia la paginación. Los datos siguen viniendo de `/api/products`; no hay productos de ejemplo ni cambios en la base.

`ProductDetail` navega al ID de la variante elegida antes de comprar. `ProductGallery` administra la imagen seleccionada y `ImageLightbox` encapsula el diálogo nativo, zoom, flechas, cierre por fondo/Escape y restauración del foco y scroll. Las imágenes se deduplican empezando por la miniatura y se recuperan de las URLs existentes del producto. Los carruseles no agregan dependencias ni rotación automática y respetan movimiento reducido.

## Consultas y efectos

`useResource` recibe un loader estable, maneja carga/errores, cancela solicitudes al cambiar de consulta o desmontar y descarta respuestas antiguas. Usar funciones de módulo o `useCallback` como loader; no pasar una función inline nueva en cada render.

El seguimiento de pagos evita consultas simultáneas y limpia tanto el polling como la redirección programada al salir de la página. La protección de rutas es una ayuda de interfaz; el backend sigue siendo responsable de autorizar operaciones y validar precios, stock y tags.

## Acceso a páginas

`ProtectedRoute` aplica listas explícitas de roles a grupos de rutas antes de renderizar sus páginas. La política compartida en `features/auth/model/access.js` también controla los enlaces de navegación. Los roles se comparan sin distinguir mayúsculas; un rol ausente o desconocido no habilita rutas privadas.

- Públicas: `/`, `/home`, `/products/:id`, `/about` y `/auth`.
- Customer y Admin: `/cart`, `/checkout/result` y `/my-purchases`.
- Sólo Admin: `/admin` y todas sus subrutas.

Cualquier acceso privado no autorizado redirige a `/` con `replace`, incluso al escribir la URL directamente. La lectura del JWT admite base64url y Unicode, pero no verifica su firma: la autorización real continúa en el backend.

## Configuración y comprobaciones

Configurar `VITE_API_BASE_URL` en `.env.local`, usando `.env.example` como referencia. Las credenciales de SMTP, Cloudinary y R2 permanecen exclusivamente en el backend.

```bash
npm test
npm run lint
npm run build
```

Las pruebas de modelos cubren tags, variantes, archivos múltiples, descuentos, catálogo, filtros, estados y sanitización del documento enriquecido. Las pruebas de arquitectura verifican que páginas/componentes no accedan a APIs directamente y que modelos/elementos compartidos mantengan sus límites. No sustituyen las pruebas de interacción en navegador.

## Estadísticas administrativas

`AdminDashboard` conserva el resumen histórico y compone `ProductStatistics`. `useProductStatistics` coordina el catálogo administrativo, filtros editables, consulta aplicada y solicitudes independientes de ventas y precios mediante `useResource`. Un cambio de consulta oculta resultados anteriores durante la carga; las peticiones se cancelan al cambiar de consulta o desmontar.

`model/statistics.js` centraliza la fecha de Argentina, rangos inclusivos, etiquetas recortadas al filtro y geometría de precios en escalones. `StatisticsFilters`, `ProductSalesChart`, `ProductPriceChart` y `ProductSalesTable` presentan los datos; las tablas tienen paginación y los gráficos SVG cuentan con controles de rango accesibles. `useChartWidth` adapta sus coordenadas al contenedor. Los estilos están limitados al dashboard en `features/admin/statistics.css`.
