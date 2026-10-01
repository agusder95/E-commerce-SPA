# Frontend — Payment Gateway SPA

Aplicación de una sola página (SPA) construida con React 19 y Vite. Proporciona una interfaz para navegar productos, gestionar un carrito de compras, autenticarse con código PIN y procesar pagos a través de MercadoPago.

## Prerrequisitos

- [Node.js 18+](https://nodejs.org/)

## Inicio desde cero (clone recién clonado)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar la URL del backend

Verificar que la URL base del API en `src/api/api.js` apunte al backend:

```js
const API_BASE = "http://localhost:5076";
```

Si el backend corre en otro puerto, modificar este valor.

### 3. Ejecutar en modo desarrollo

```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`.

> **Nota:** El backend y la infraestructura (SQL Server, Redis) deben estar corriendo para que la aplicación funcione correctamente. Ver [Backend README](../Backend/README.md) para instrucciones.

## Scripts disponibles

| Script | Comando | Descripción |
|--------|---------|------------|
| Desarrollo | `npm run dev` | Inicia el servidor de desarrollo con HMR |
| Build | `npm run build` | Genera la versión de producción en `dist/` |
| Lint | `npm run lint` | Ejecuta oxlint para verificar el código |
| Preview | `npm run preview` | Previsualiza la versión de producción localmente |

## Rutas del SPA

| Ruta | Componente | Descripción |
|------|-----------|------------|
| `/` | Products | Catálogo de 6 productos con precios en ARS |
| `/cart` | Cart | Carrito de compras con controles de cantidad y eliminación |
| `/auth` | Auth | Flujo de autenticación: email → PIN de 6 dígitos → JWT |
| `/checkout/result` | CheckoutResult | Página de polling que espera la confirmación del pago |
| `/my-purchases` | MyPurchases | Historial de compras con tabs "Aprobadas" y "Pendientes / Canceladas" |

## Estructura del código fuente

```
src/
├── main.jsx                    # Punto de entrada (BrowserRouter + AuthProvider)
├── App.jsx                     # Rutas, CartProvider, Navbar global
├── App.css                     # Estilos globales de componentes
├── index.css                   # Variables CSS y reset base
├── api/
│   └── api.js                  # Cliente HTTP con manejo de JWT
├── components/
│   ├── Navbar.jsx              # Barra de navegación con badge del carrito
│   ├── ProductCard.jsx         # Tarjeta de producto con botón "Agregar"
│   └── CartItem.jsx            # Fila del carrito con controles +/- y eliminar
├── context/
│   ├── AuthContext.jsx          # Estado de autenticación (token, email en localStorage)
│   ├── useAuth.js               # Hook para acceder al contexto de auth
│   ├── CartContext.jsx          # Estado del carrito (add, increment, decrement, remove, clear)
│   └── useCart.js               # Hook para acceder al contexto del carrito
└── pages/
    ├── Products.jsx             # Catálogo de productos
    ├── Cart.jsx                 # Carrito + checkout con MercadoPago
    ├── Auth.jsx                 # Autenticación con PIN (6 inputs individuales + countdown)
    ├── CheckoutResult.jsx       # Polling de estado de pago con botón "Volver al pago"
    └── MyPurchases.jsx          # Compras con tabs aprobadas/pendientes
```

## Dependencias principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `react` | ^19.2.8 | Framework de UI |
| `react-dom` | ^19.2.8 | Renderizado DOM |
| `react-router-dom` | ^7.18.2 | Enrutamiento SPA |
| `vite` | ^8.2.0 | Bundler y dev server |
| `oxlint` | ^1.75.0 | Linting (configurado en `.oxlintrc.json`) |

## Diseño visual

- **Estilo**: minimalista, fondo blanco con acentos azules (`#2563eb`)
- **Bordes redondeados**: `border-radius: 10px`
- **Responsive**: adaptable a mobile y desktop
- **Componentes clave**: input PIN con casillas individuales, tabs de historial, spinner de carga para polling de pagos
