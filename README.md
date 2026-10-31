# Inversiones Ferrera

Sistema de punto de venta y gestión para verdulería / minimarket: venta minorista y mayorista, cuentas corrientes (fiado) con clientes, cuentas por pagar con proveedores y un modelo de datos preparado para múltiples sucursales.

> **Estado**: base técnica, datos maestros y caja/ventas completa (Etapa 1 online y Etapa 2 sin conexión). Están armados el stack, el esquema de datos, la autenticación con roles, el routing con permisos, el ABM de categorías, productos, clientes, proveedores y usuarios, y la caja: venta de local y pedido con escaneo, cobro en efectivo, transferencia, tarjeta o fiado, descuento de stock, comprobante imprimible, ventas del día, anulación y venta sin conexión con sincronización automática. El resto de los módulos operativos (compras y stock, cuentas, cierres, reportes) todavía son pantallas placeholder.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript estricto |
| Base de datos | PostgreSQL (Railway en producción) |
| ORM | Prisma 6 |
| Autenticación | Auth.js v5 (NextAuth), provider de credenciales, sesión JWT |
| Estilos | Tailwind CSS 4 |
| Deploy | Vercel (app) + Railway (Postgres) |

Dependencias fuera de la lista del stack: **bcryptjs**, para hashear y verificar las contraseñas que guarda `Usuario.passwordHash` (el schema exige un hash y Auth.js no trae uno propio). Se eligió `bcryptjs` (JS puro) en lugar de `bcrypt` porque no requiere compilación nativa en Vercel. **tsx** se usa solo en desarrollo, para ejecutar el seed escrito en TypeScript. **idb** envuelve IndexedDB, donde la caja guarda el catálogo y la cola de ventas sin conexión (la API nativa es muy verbosa). El service worker (`public/sw.js`) está escrito a mano en vez de usar `@serwist/next`: solo hace falta abrir /caja sin red, y Serwist exige un plugin de webpack en `next.config`.

---

## Puesta en marcha local

Requisitos: Node.js 20+ y un PostgreSQL accesible (local o Railway).

```bash
# 1. Instalar dependencias (genera el Prisma Client automáticamente)
npm install

# 2. Configurar variables de entorno
#    El repo trae un .env con valores de ejemplo (no versionado): editarlo con
#    la cadena de conexión real y un secreto propio. Si no existe:
#    cp .env.example .env

# 3. Crear las tablas en la base de datos
npm run db:migrate

# 4. Cargar datos de prueba
npm run db:seed

# 5. Levantar el servidor de desarrollo
npm run dev
```

La app queda en http://localhost:3000.

### Variables de entorno

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL, ej. `postgresql://usuario:password@localhost:5432/inversiones_ferrera?schema=public` |
| `NEXTAUTH_URL` | URL pública de la app (`http://localhost:3000` en desarrollo) |
| `NEXTAUTH_SECRET` | Secreto para firmar las sesiones. Generar con `npx auth secret` u `openssl rand -base64 32` |

`.env` está en `.gitignore`; `.env.example` es la plantilla que sí se versiona. Auth.js v5 también acepta `AUTH_SECRET` / `AUTH_URL`: la configuración lee `AUTH_SECRET` y, si no está, cae a `NEXTAUTH_SECRET`.

### Usuarios de prueba (creados por el seed)

| Email | Contraseña | Rol |
| --- | --- | --- |
| `admin@ferrera.com` | `ferrera123` | `ADMINISTRADOR` |
| `caja@ferrera.com` | `ferrera123` | `EMPLEADO_CAJA` |

Son credenciales de desarrollo: no usarlas en producción.

El seed además crea la sucursal "Local Principal", las categorías Verduras / Frutas / Granos / Snacks, un proveedor, cinco productos con stock inicial (por peso, por unidad y por paquete con código de barras; uno con poco stock y otro vencido, para probar las advertencias de caja) y cuatro clientes: minorista con fiado, mayorista con fiado y límite, mayorista con fiado sin tope y minorista sin fiado. Es idempotente (usa `upsert` o busca por nombre), así que se puede correr varias veces sin duplicar datos ni pisar lo cargado a mano.

---

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Genera el Prisma Client y compila para producción |
| `npm start` | Sirve el build de producción |
| `npm run lint` | ESLint (configuración de Next) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Aplica migraciones en desarrollo (`prisma migrate dev`) |
| `npm run db:deploy` | Aplica migraciones en producción (`prisma migrate deploy`) |
| `npm run db:seed` | Carga los datos de prueba |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:generate` | Regenera el Prisma Client |

---

## Roles y permisos

Dos roles, definidos en el enum `Rol`:

- **`ADMINISTRADOR`**: acceso a todos los módulos.
- **`EMPLEADO_CAJA`**: solo `/caja` y `/cierres`. Si intenta entrar a otra ruta protegida, se lo redirige a `/caja`.

El chequeo está **centralizado en un solo lugar**: [lib/permissions.ts](lib/permissions.ts) define la tabla `MODULOS` (ruta → roles habilitados), y esa tabla la consumen:

- [middleware.ts](middleware.ts), a través del callback `authorized` de [lib/auth.config.ts](lib/auth.config.ts), que corta el acceso antes de renderizar.
- El layout del dashboard, que arma la navegación con `modulosVisibles(rol)` y revalida la sesión del lado del servidor.

Ninguna página repite la validación. Para agregar un módulo nuevo alcanza con sumar una fila a `MODULOS` y crear la carpeta bajo `app/(dashboard)/`.

Las rutas de `/api` que se agreguen más adelante quedan fuera del matcher del middleware: deben validar la sesión con `auth()` dentro del route handler.

**Server actions.** El middleware protege páginas, no acciones: una server action se puede invocar desde cualquier ruta con sesión. Por eso toda acción que escribe datos de administración empieza con `await exigirAdministrador()` ([lib/acceso.ts](lib/acceso.ts)), que confirma el rol contra la base y no solo contra el JWT.

### Cómo funciona la autenticación

La sesión es por **JWT** (no hay tabla de sesiones): el token lleva `id`, `rol` y `sucursalId`, para que el middleware pueda resolver permisos en el Edge Runtime sin consultar la base de datos.

Como el token congela el rol del momento del login, el layout del dashboard lo compara con la base en cada carga: si el usuario fue desactivado o le cambiaron rol o sucursal, lo manda a `/api/sesion/cerrar`, que cierra la sesión y vuelve al login.

La configuración está partida en dos a propósito:

- [lib/auth.config.ts](lib/auth.config.ts): configuración compartida (callbacks, páginas, permisos). Es **edge-safe**, no importa Prisma. La usa el middleware.
- [lib/auth.ts](lib/auth.ts): agrega el provider de credenciales, que necesita Prisma y bcrypt (solo Node). La usan los server components, las server actions y el route handler de `/api/auth`.

---

## Estructura del proyecto

```
app/
  (auth)/login/            formulario de ingreso (server action + Auth.js)
  (dashboard)/
    _components/           nav lateral y placeholder de módulos
    caja/                  ventas (ambos roles)
    cierres/               cierres de caja (ambos roles)
    productos/             solo ADMINISTRADOR (incluye categorias/)
      nuevo/, [id]/        alta y edición; igual en clientes, proveedores y usuarios
      actions.ts           server actions del módulo
    clientes/              solo ADMINISTRADOR
    proveedores/           solo ADMINISTRADOR
    compras/               solo ADMINISTRADOR
    gastos/                solo ADMINISTRADOR
    reportes/              solo ADMINISTRADOR
    usuarios/              solo ADMINISTRADOR
    layout.tsx             valida sesión + navegación según rol
  api/auth/[...nextauth]/  handlers de Auth.js
  api/sesion/cerrar/       cierra una sesión desactualizada respecto de la base
  page.tsx                 redirige al módulo por defecto según el rol
components/ui/             primitivas de interfaz (botón, campo, tabla, filtros, formulario…)
lib/
  acceso.ts                guardia de rol para server actions
  auth.ts                  Auth.js con el provider de credenciales (Node)
  auth.config.ts           configuración compartida, edge-safe (middleware)
  formato.ts               formato de precios, cantidades y fechas
  formulario.ts            lectura y validación de formularios en server actions
  listados.ts              parámetros de búsqueda y filtros de los listados
  permissions.ts           tabla de módulos y helpers de rol
  prisma.ts                cliente de Prisma (singleton)
prisma/
  schema.prisma            modelo de datos completo
  seed.ts                  datos de prueba
  migrations/              migración inicial
types/
  next-auth.d.ts           tipos de sesión/JWT extendidos con rol y sucursalId
middleware.ts              protección de rutas y chequeo de rol
```

---

## Modelo de datos

El schema completo está en [prisma/schema.prisma](prisma/schema.prisma). Entidades principales:

- **Catálogo**: `Sucursal`, `Categoria`, `Proveedor`, `Producto`, `Stock` (stock por producto y sucursal).
- **Personas**: `Usuario` (con rol y sucursal), `Cliente` (minorista/mayorista; `fiadoHabilitado` define si puede comprar fiado y `limiteCredito` el tope, vacío = sin tope).
- **Operaciones**: `Venta` / `DetalleVenta`, `Compra` / `DetalleCompra`, `CierreCaja`, `Gasto`.
- **Cuentas**: `MovimientoCuenta` (fiado de clientes) y `MovimientoProveedor` (cuentas por pagar).

Los importes usan `Decimal(10,2)` y las cantidades `Decimal(10,3)`, para poder vender por peso. Los modelos y campos están en español, igual que el resto de la documentación del proyecto (diagrama ER, DBML).

---

## Deploy

**Base de datos (Railway)**: crear un Postgres, copiar la connection string a `DATABASE_URL` y aplicar el esquema con `npm run db:deploy`.

**App (Vercel)**: importar el repo y cargar `DATABASE_URL`, `NEXTAUTH_URL` (el dominio de Vercel) y `NEXTAUTH_SECRET` en las variables del proyecto. El script `build` ya corre `prisma generate` antes de compilar, que es lo que Vercel necesita por el cacheo de dependencias.

---

## Convenciones

- TypeScript estricto: `npm run typecheck` tiene que pasar limpio.
- Nombres de modelos y campos de Prisma en español, consistentes con la documentación del proyecto.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …).
- No agregar librerías fuera del stack sin justificarlo en este README.

---

## Caja sin conexión

Si se cae internet, la caja sigue cobrando: el service worker sirve `/caja` y `/caja/pendientes` desde la caché, el catálogo sale de IndexedDB y cada venta queda en una cola local que se sincroniza sola al volver la red (o con "Sincronizar ahora" en `/caja/pendientes`). El servidor nunca rechaza una venta offline por reglas que dependen del estado actual (límite de crédito, cliente o producto desactivado, precio o fecha): la registra con `requiereRevision` y el administrador la ve marcada en las ventas del día.

El service worker solo se registra en producción. Para probarlo en local: `npm run build && npm start`, abrir `/caja` una vez con conexión y después cortar la red (en las herramientas del navegador o apagando el servidor).

## Próximos pasos

Con la caja completa, siguen los módulos que dependen de ella: cierre de caja (que deberá bloquearse mientras haya ventas sin sincronizar), abonos a cuentas de clientes, compras y stock, y reportes.
