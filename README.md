# Juegos Fueguinos AMB

Aplicación de comercio electrónico para la venta de productos digitales. El proyecto está compuesto por una API REST en .NET y una interfaz web en React.

## Componentes

| Componente | Tecnología | Documentación |
|---|---|---|
| Backend | .NET 10, ASP.NET Core, Entity Framework Core, PostgreSQL y Redis | [Backend/README.md](Backend/README.md) |
| Frontend | React 19, Vite y React Router | [Frontend/PaymentFront/README.md](Frontend/PaymentFront/README.md) |

## Funcionalidades

- Catálogo de productos.
- Carrito de compras.
- Autenticación mediante PIN enviado por email.
- Tokens JWT para sesiones autenticadas.
- Creación de órdenes.
- Integración con Mercado Pago.
- Consulta de compras aprobadas y pendientes.
- Webhooks para actualizar el estado de los pagos.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior y npm.
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) para PostgreSQL y Redis.
- Una cuenta de Mercado Pago y un proveedor SMTP para probar el flujo completo.

## Estructura del repositorio

```text
E-commerce-SPA/
├── Backend/
│   ├── PaymentGateway/
│   │   ├── PaymentGateway.API/
│   │   ├── PaymentGateway.Application/
│   │   ├── PaymentGateway.Domain/
│   │   ├── PaymentGateway.Infrastructure/
│   │   └── compose.yaml
│   └── README.md
├── Frontend/
│   └── PaymentFront/
│       ├── src/
│       ├── package.json
│       └── README.md
└── README.md
```

## Inicio rápido

### 1. Preparar el Backend

Seguir las instrucciones de [Backend/README.md](Backend/README.md) para crear la configuración local, levantar PostgreSQL y Redis, aplicar las migraciones y ejecutar la API.

La API queda disponible por defecto en:

```text
http://localhost:5076
```

### 2. Preparar el Frontend

En otra terminal:

```bash
cd Frontend/PaymentFront
npm install
npm run dev
```

La aplicación queda disponible normalmente en `http://localhost:5173`.

El Frontend espera encontrar la API en `http://localhost:5076`. Si se cambia el puerto o el host del Backend, actualizar `Frontend/PaymentFront/src/api/api.js`.

## Flujo de uso

1. Abrir el Frontend y consultar los productos.
2. Agregar productos al carrito.
3. Solicitar un PIN con un email válido.
4. Validar el PIN para obtener una sesión.
5. Crear la orden y continuar al checkout de Mercado Pago.
6. Consultar el resultado del pago y el historial de compras.

## Configuración y seguridad

La configuración local del Backend utiliza archivos que no deben subirse al repositorio:

- `Backend/PaymentGateway/.env`
- `Backend/PaymentGateway/PaymentGateway.API/appsettings.Development.json`

Usar los archivos `.example` incluidos como plantilla. No subir tokens de Mercado Pago, contraseñas SMTP, claves JWT ni credenciales de bases de datos.

## Desarrollo

Backend:

```bash
cd Backend/PaymentGateway
dotnet build
dotnet test
```

Frontend:

```bash
cd Frontend/PaymentFront
npm run lint
npm run build
```

Para conocer los endpoints, la arquitectura y las instrucciones completas de cada parte, consultar sus respectivos README.

## Licencia

Este proyecto incluye el archivo [LICENSE](LICENSE).
