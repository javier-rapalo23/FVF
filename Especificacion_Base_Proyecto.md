# Sistema para Verdulería — Base del proyecto

Este documento es la especificación para generar el esqueleto inicial del proyecto. El objetivo de esta primera tarea es dejar la base técnica lista y funcionando (sin lógica de negocio todavía) para empezar a construir los módulos encima.

---

## 1. Stack técnico

- **Framework**: Next.js 14+ (App Router) con TypeScript
- **Base de datos**: PostgreSQL
- **ORM**: Prisma
- **Autenticación**: Auth.js (NextAuth), estrategia de credenciales (usuario/contraseña) con sesión
- **Estilos**: Tailwind CSS
- **Despliegue de la app**: Vercel
- **Despliegue de la base de datos**: Railway (Postgres)
- **Repositorio**: GitHub (ya se está creando por separado)

No usar ningún otro framework de UI, ORM alternativo, ni servicio de auth externo (Clerk, Supabase Auth, etc.) — mantener todo dentro de este stack.

---

## 2. Qué tiene que quedar armado en esta tarea

1. Proyecto Next.js + TypeScript inicializado, con App Router y Tailwind configurado.
2. Prisma configurado, con el schema completo de la sección 4 y la primera migración generada.
3. Seed de base de datos con datos mínimos de prueba (ver sección 6).
4. Auth.js configurado con login por credenciales, sesión con rol (`ADMINISTRADOR` \| `EMPLEADO_CAJA`) y `sucursalId` disponibles en la sesión.
5. Middleware de rutas protegidas: todo lo que esté bajo `/app/(dashboard)` requiere sesión iniciada.
6. Estructura de carpetas de la sección 5, con páginas placeholder (sin funcionalidad real) para cada módulo, solo para validar que el routing y los permisos por rol funcionan.
7. Variables de entorno documentadas en un `.env.example`.
8. README con instrucciones de cómo correr el proyecto localmente (instalar, generar Prisma client, migrar, hacer seed, levantar el dev server).

No implementar todavía: lógica de ventas, stock, reportes, ni ninguna regla de negocio. Esta tarea es solo la base.

---

## 3. Roles y acceso

- `ADMINISTRADOR`: acceso a todas las rutas.
- `EMPLEADO_CAJA`: acceso solo a las rutas del módulo de ventas/caja. Si intenta entrar a otra ruta protegida, redirigir a `/caja` (o mostrar 403).

El chequeo de rol debe resolverse centralizado (middleware o un helper compartido), no repetido manualmente en cada página.

---

## 4. Schema de Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Rol {
  ADMINISTRADOR
  EMPLEADO_CAJA
}

enum TipoCliente {
  MINORISTA
  MAYORISTA
}

enum UnidadVenta {
  PESO
  UNIDAD
  PAQUETE
}

enum Canal {
  LOCAL
  PEDIDO
}

enum MetodoPago {
  EFECTIVO
  TRANSFERENCIA
  TARJETA
  FIADO
}

enum TipoMovimientoCuenta {
  CARGO
  ABONO
}

enum TipoMovimientoProveedor {
  CARGO
  PAGO
}

enum CategoriaGasto {
  OPERATIVO
  MERCADERIA
  ADMINISTRATIVO
}

model Sucursal {
  id        Int      @id @default(autoincrement())
  nombre    String
  direccion String?
  creadoEn  DateTime @default(now())

  usuarios          Usuario[]
  stock             Stock[]
  ventas            Venta[]
  compras           Compra[]
  cierresCaja       CierreCaja[]
  gastos            Gasto[]
}

model Categoria {
  id       Int       @id @default(autoincrement())
  nombre   String    @unique
  productos Producto[]
}

model Proveedor {
  id       Int       @id @default(autoincrement())
  nombre   String
  telefono String?

  productos           Producto[]
  compras             Compra[]
  movimientosProveedor MovimientoProveedor[]
}

model Producto {
  id                Int       @id @default(autoincrement())
  idInterno         Int       @unique
  codigoBarras      String?   @unique
  nombre            String
  categoriaId       Int
  categoria         Categoria @relation(fields: [categoriaId], references: [id])
  proveedorId       Int?
  proveedor         Proveedor? @relation(fields: [proveedorId], references: [id])
  unidadVenta       UnidadVenta
  precioMinorista   Decimal   @db.Decimal(10, 2)
  precioMayorista   Decimal   @db.Decimal(10, 2)
  fechaVencimiento  DateTime?
  activo            Boolean   @default(true)
  creadoEn          DateTime  @default(now())

  stock          Stock[]
  detallesVenta  DetalleVenta[]
  detallesCompra DetalleCompra[]
}

model Stock {
  id          Int      @id @default(autoincrement())
  productoId  Int
  producto    Producto @relation(fields: [productoId], references: [id])
  sucursalId  Int
  sucursal    Sucursal @relation(fields: [sucursalId], references: [id])
  cantidad    Decimal  @db.Decimal(10, 3)

  @@unique([productoId, sucursalId])
}

model Usuario {
  id           Int      @id @default(autoincrement())
  nombre       String
  email        String   @unique
  passwordHash String
  rol          Rol
  sucursalId   Int?
  sucursal     Sucursal? @relation(fields: [sucursalId], references: [id])
  activo       Boolean  @default(true)
  creadoEn     DateTime @default(now())

  ventas       Venta[]
  compras      Compra[]
  cierresCaja  CierreCaja[]
  gastos       Gasto[]
}

model Cliente {
  id             Int         @id @default(autoincrement())
  nombre         String
  tipo           TipoCliente @default(MINORISTA)
  limiteCredito  Decimal?    @db.Decimal(10, 2)
  telefono       String?
  activo         Boolean     @default(true)
  creadoEn       DateTime    @default(now())

  ventas             Venta[]
  movimientosCuenta  MovimientoCuenta[]
}

model Venta {
  id          Int        @id @default(autoincrement())
  fecha       DateTime   @default(now())
  clienteId   Int?
  cliente     Cliente?   @relation(fields: [clienteId], references: [id])
  usuarioId   Int
  usuario     Usuario    @relation(fields: [usuarioId], references: [id])
  sucursalId  Int
  sucursal    Sucursal   @relation(fields: [sucursalId], references: [id])
  canal       Canal
  metodoPago  MetodoPago
  total       Decimal    @db.Decimal(10, 2)
  anulada     Boolean    @default(false)

  detalles           DetalleVenta[]
  movimientosCuenta  MovimientoCuenta[]
}

model DetalleVenta {
  id              Int      @id @default(autoincrement())
  ventaId         Int
  venta           Venta    @relation(fields: [ventaId], references: [id])
  productoId      Int
  producto        Producto @relation(fields: [productoId], references: [id])
  cantidad        Decimal  @db.Decimal(10, 3)
  precioUnitario  Decimal  @db.Decimal(10, 2)
  subtotal        Decimal  @db.Decimal(10, 2)
}

model Compra {
  id          Int      @id @default(autoincrement())
  fecha       DateTime @default(now())
  proveedorId Int
  proveedor   Proveedor @relation(fields: [proveedorId], references: [id])
  usuarioId   Int
  usuario     Usuario  @relation(fields: [usuarioId], references: [id])
  sucursalId  Int
  sucursal    Sucursal @relation(fields: [sucursalId], references: [id])
  total       Decimal  @db.Decimal(10, 2)

  detalles              DetalleCompra[]
  movimientosProveedor  MovimientoProveedor[]
}

model DetalleCompra {
  id             Int      @id @default(autoincrement())
  compraId       Int
  compra         Compra   @relation(fields: [compraId], references: [id])
  productoId     Int
  producto       Producto @relation(fields: [productoId], references: [id])
  cantidad       Decimal  @db.Decimal(10, 3)
  costoUnitario  Decimal  @db.Decimal(10, 2)
}

model MovimientoCuenta {
  id         Int                   @id @default(autoincrement())
  clienteId  Int
  cliente    Cliente               @relation(fields: [clienteId], references: [id])
  ventaId    Int?
  venta      Venta?                @relation(fields: [ventaId], references: [id])
  tipo       TipoMovimientoCuenta
  monto      Decimal               @db.Decimal(10, 2)
  fecha      DateTime              @default(now())
}

model MovimientoProveedor {
  id           Int                      @id @default(autoincrement())
  proveedorId  Int
  proveedor    Proveedor                @relation(fields: [proveedorId], references: [id])
  compraId     Int?
  compra       Compra?                  @relation(fields: [compraId], references: [id])
  tipo         TipoMovimientoProveedor
  monto        Decimal                  @db.Decimal(10, 2)
  fecha        DateTime                 @default(now())
}

model CierreCaja {
  id            Int      @id @default(autoincrement())
  fecha         DateTime @default(now())
  usuarioId     Int
  usuario       Usuario  @relation(fields: [usuarioId], references: [id])
  sucursalId    Int
  sucursal      Sucursal @relation(fields: [sucursalId], references: [id])
  totalSistema  Decimal  @db.Decimal(10, 2)
  totalContado  Decimal  @db.Decimal(10, 2)
  diferencia    Decimal  @db.Decimal(10, 2)
}

model Gasto {
  id           Int             @id @default(autoincrement())
  fecha        DateTime        @default(now())
  categoria    CategoriaGasto
  monto        Decimal         @db.Decimal(10, 2)
  usuarioId    Int
  usuario      Usuario         @relation(fields: [usuarioId], references: [id])
  sucursalId   Int?
  sucursal     Sucursal?       @relation(fields: [sucursalId], references: [id])
  descripcion  String?
}
```

---

## 5. Estructura de carpetas sugerida

```
/app
  /(auth)
    /login
  /(dashboard)
    /caja              -> módulo de ventas (accesible por ambos roles)
    /productos          -> solo ADMINISTRADOR
    /clientes           -> solo ADMINISTRADOR
    /proveedores        -> solo ADMINISTRADOR
    /compras            -> solo ADMINISTRADOR
    /cierres            -> ambos roles (empleado registra, administrador revisa)
    /gastos             -> solo ADMINISTRADOR
    /reportes           -> solo ADMINISTRADOR
    /usuarios           -> solo ADMINISTRADOR
    layout.tsx          -> valida sesión + navegación según rol
/lib
  /auth.ts              -> configuración de Auth.js
  /prisma.ts            -> cliente de Prisma (singleton)
  /permissions.ts        -> helper de chequeo de rol
/prisma
  /schema.prisma
  /seed.ts
/middleware.ts
.env.example
```

Cada página placeholder debe mostrar simplemente el nombre del módulo y un texto indicando que está pendiente de implementar — el objetivo es validar navegación y permisos, no construir UI todavía.

---

## 6. Seed de datos de prueba

El seed debe crear:

- 1 sucursal (ej. "Local Principal")
- 2 usuarios: uno `ADMINISTRADOR` y uno `EMPLEADO_CAJA`, ambos con contraseña de prueba documentada en el README
- 3-4 categorías (ej. Verduras, Frutas, Granos, Snacks)
- 2-3 productos de ejemplo, con stock inicial en la sucursal creada
- 1 proveedor de ejemplo
- 1 cliente de ejemplo (minorista)

---

## 7. Variables de entorno (`.env.example`)

```
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
```

---

## 8. Convenciones de código

- TypeScript estricto (`strict: true` en `tsconfig.json`).
- Nombres de modelos y campos de Prisma en español, tal como está en el schema — mantener consistencia con la documentación del proyecto (diagrama ER, DBML) que también está en español.
- Commits siguiendo Conventional Commits (`feat:`, `fix:`, `chore:`, etc.), ya que el proyecto se va a ir armando de forma incremental.
- No agregar librerías fuera de lo listado en la sección 1 sin justificar por qué hace falta.

---

## 9. Notas de contexto para el agente

Este proyecto es un sistema de punto de venta y gestión para una verdulería/minimarket que vende productos frescos (verduras, frutas, pollo, lácteos) y abarrotes (granos, café, snacks, bebidas). Tiene venta minorista y mayorista, maneja cuentas corrientes (fiado) con clientes y cuentas por pagar con proveedores, y está diseñado desde el modelo de datos para soportar múltiples sucursales a futuro, aunque el MVP arranca con una sola.

El módulo más crítico del sistema, que se va a construir después de esta base, es el de **ventas/caja** — tiene que funcionar rápido y sin fricción para el empleado, y eventualmente soportar guardado local si se cae la conexión (no implementar esto todavía, pero tenerlo en cuenta al estructurar el módulo).
