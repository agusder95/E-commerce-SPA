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

El endpoint del backend está definido actualmente en `src/api/api.js`:

```js
const API_BASE = "http://localhost:5076";
```

Si el backend utiliza otro host o puerto, actualizar ese valor antes de iniciar la aplicación.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo con recarga automática |
| `npm run build` | Genera la versión optimizada para producción en `dist/` |
| `npm run preview` | Sirve localmente la build de producción |
| `npm run lint` | Ejecuta Oxlint sobre el proyecto |

## Flujo principal

1. La página inicial muestra los productos disponibles.
2. El usuario agrega productos al carrito.
3. La autenticación solicita un PIN por email y luego obtiene un JWT.
4. El carrito crea una orden mediante el backend.
5. El usuario es redirigido al checkout de Mercado Pago.
6. La página de resultado consulta y muestra el estado de la orden.
7. La sección de compras permite consultar órdenes aprobadas y pendientes.

## Rutas de la aplicación

| Ruta | Vista |
|---|---|
| `/` | Productos |
| `/cart` | Carrito |
| `/auth` | Autenticación por PIN |
| `/checkout/result` | Resultado del checkout |
| `/my-purchases` | Mis compras |

## Estructura del código

```text
src/
├── api/         # Funciones para comunicarse con la API
├── assets/      # Imágenes y recursos estáticos
├── components/  # Navbar, productos y elementos del carrito
├── context/     # Estado global de autenticación y carrito
├── pages/       # Vistas asociadas a las rutas
├── App.jsx      # Configuración de rutas
└── main.jsx     # Punto de entrada
```

El token JWT y el email de la sesión se guardan en `localStorage`. El token se envía automáticamente como `Authorization: Bearer <jwt>` en las solicitudes protegidas.

## Build de producción

```bash
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
