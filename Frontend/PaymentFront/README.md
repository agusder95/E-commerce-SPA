# Payment Front

Frontend de la aplicación de comercio electrónico, construido con React 19 y Vite. Permite consultar productos, armar un carrito, autenticarse mediante PIN, crear órdenes y consultar el estado de las compras.

## Requisitos

- Node.js 20 o superior
- npm
- Backend de Payment Gateway ejecutándose en `http://localhost:5076`

## Instalación

Desde `Frontend/PaymentFront`:

```bash
npm install
```

## Ejecución en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en la URL que muestre Vite, normalmente `http://localhost:5173`.

El endpoint se configura mediante `VITE_API_BASE_URL` en `.env.local`; el valor por defecto es `http://localhost:5076`. Consultar `.env.example`. El transporte HTTP está centralizado en `src/shared/api/client.js`.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo con recarga automática |
| `npm run build` | Genera la versión optimizada para producción en `dist/` |
| `npm run preview` | Sirve localmente la build de producción |
| `npm run lint` | Ejecuta Oxlint sobre el proyecto |
| `npm test` | Ejecuta pruebas de modelos y límites de arquitectura |

## Flujo principal

1. La página inicial muestra los productos disponibles.
2. El usuario agrega productos al carrito.
3. La autenticación solicita un PIN por email y luego obtiene un JWT.
4. El carrito crea una orden mediante el backend.
5. El checkout de Mercado Pago se abre en una pestaña nueva.
6. La página de resultado consulta y muestra el estado de la orden.
7. La sección de compras permite consultar órdenes aprobadas y pendientes.

El carrito conserva localmente las órdenes iniciadas y los productos incluidos. Al volver a la tienda, verifica el pago con el backend y elimina únicamente las cantidades compradas, aunque se haya cerrado la pestaña durante el pago. Los productos agregados posteriormente se conservan. Esta recuperación requiere que la orden se haya iniciado con esta versión y que se mantenga el almacenamiento del navegador.

## Rutas de la aplicación

| Ruta | Vista |
|---|---|
| `/` | Productos |
| `/home` | Home: hero, nuevos, colecciones y todos |
| `/products/:id` | Detalle, selección de formato y galería ampliada |
| `/cart` | Carrito |
| `/auth` | Autenticación por PIN |
| `/checkout/result` | Resultado del checkout |
| `/my-purchases` | Mis compras |

## Estructura del código

El código está organizado por funcionalidades (`features`), composición de la aplicación (`app`) e infraestructura y controles reutilizables (`shared`). Cada funcionalidad separa páginas, componentes, hooks, APIs y modelos según su necesidad.

Ver [arquitectura y responsabilidades](ARCHITECTURE.md) para el árbol de carpetas, reglas de dependencia y ejemplos.

El token JWT y el email de la sesión se guardan en `localStorage`. El token se envía automáticamente como `Authorization: Bearer <jwt>` en las solicitudes protegidas.

## Build de producción

```bash
npm test
npm run lint
npm run build
npm run preview
```

La salida se genera en `dist/`. Esta carpeta está excluida por Git y debe generarse nuevamente en cada entorno de despliegue.

## Solución de problemas

- Si aparece un error de red, comprobar que la API esté ejecutándose en `http://localhost:5076`.
- Si el navegador bloquea las solicitudes, verificar la configuración CORS del backend y que el frontend use `http://localhost:5173`.
- Si el checkout no vuelve a la aplicación, comprobar las URLs de retorno configuradas en el servicio de Mercado Pago.
- Si las dependencias están desactualizadas o incompletas, eliminar `node_modules` y ejecutar nuevamente `npm install`.

## Interfaz visual

La identidad usa el nombre provisional **Forma**. El catálogo consume /api/products; las imágenes se obtienen de Cloudinary mediante las URLs guardadas en PostgreSQL. Una base sin productos muestra el catálogo vacío.

- `/products/:id`: detalle del producto y acceso al carrito.
- `/about`: presentación provisional, pendiente de contenido personal.
- `/admin`: dashboard; `/admin/purchases`: compras; `/admin/products`: productos; `/admin/offers`: ofertas y códigos.
- Carrito y compras requieren sesión. Administración requiere el rol `Admin` del contexto existente. La protección del frontend no reemplaza la autorización del servidor.

Las vistas administrativas consumen /api/admin: permiten guardar/desactivar productos, subir imágenes y archivos, crear cupones y consultar compras y estadísticas reales. El backend exige rol administrador.

Los productos digitales admiten hasta 50 archivos de 100 MB cada uno, con descargas individuales en Mis compras. La descripción utiliza un editor Lexical con formato, listas anidadas, sangrías y alineación; el catálogo muestra ese formato sin cargar el editor y mantiene las descripciones anteriores en texto plano.

El catálogo mock fue eliminado. La adaptación de los DTOs está en `src/features/catalog/model/product.js`; los formatos, en `src/shared/utils/format.js`. La administración está en `src/features/admin/`, con componentes y hooks separados. Configurar VITE_API_BASE_URL según .env.example. Las credenciales Cloudinary/R2 van exclusivamente en el backend: ver [configuración de almacenamiento](../../Backend/STORAGE.md).

### Dashboard: ventas y precios por producto

En `/admin`, el resumen de la tienda permite consultar hoy, 7 días, 30 días o un rango de fechas. La sección **Ventas y precios** permite buscar por nombre y elegir entre uno y tres productos (incluye productos eliminados), fechas y agrupación diaria, semanal o mensual. La búsqueda conserva la selección y distingue los formatos físicos y digitales. Los atajos de 7, 30, 90 días y año actual usan la fecha de Argentina; los filtros se aplican al presionar **Ver estadísticas**.

El resultado muestra unidades, importe después de ofertas y cupones y precio promedio por unidad. El gráfico de barras alterna entre unidades e importe, con un control para explorar períodos y una tabla paginada. El gráfico de precios muestra el precio de lista y el precio publicado con ofertas mediante escalones en sus fechas reales; el fondo verde identifica ofertas y el detalle incluye los vencimientos. Los controles de rango se pueden operar con teclado y táctil. No se agregaron librerías de gráficos.

Al comparar varios productos, las ventas se muestran en barras agrupadas y los precios en líneas sobre las mismas fechas y escalas. Cada producto conserva un color en su selección, leyendas, gráficos y tablas. Los tramos sin historial de precios quedan vacíos y los errores se informan por producto, manteniendo los resultados disponibles de los demás. Los colores de los productos restantes se conservan al reemplazar una selección.

Las consultas consumen `GET /api/admin/statistics/products/{id}/sales` y `/prices`, con cancelación y descarte de respuestas antiguas. Las fechas se interpretan en Argentina y las ventas se asignan a la aprobación del pago. Los mensajes distinguen períodos sin ventas, órdenes sin fecha de aprobación e historial de precios desconocido. Las consultas de ventas y precios manejan sus errores por separado y permiten reintentar.
