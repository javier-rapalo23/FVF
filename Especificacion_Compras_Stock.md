# Sistema para Verdulería — Módulo de compras e inventario

Especificación para implementar las compras a proveedores y el control de inventario, sobre la base del proyecto, los datos maestros y la caja ya construidos. Hoy el stock solo baja (ventas) o vuelve por una anulación; este módulo agrega las entradas de mercadería, el costo de los productos y los ajustes con motivo que la caja dejó pendientes.

---

## 1. Alcance y etapas

**Etapa 1 — Compras.** Se implementa entera y al terminar se detiene el trabajo para revisión.

- Registro de compras a proveedores con detalle por producto, cantidad y costo unitario
- Ingreso de la mercadería al stock de la sucursal
- Compra de contado o a crédito; la de crédito genera el cargo en la cuenta del proveedor
- Último costo por producto y saldo por pagar visible en cada proveedor
- Listado y detalle de compras
- Anulación de compras (solo administrador)

**Etapa 2 — Inventario y ajustes.** No empezar hasta que se confirme que la Etapa 1 está validada.

- Pantalla de inventario por sucursal con alertas de stock bajo, negativo y vencido
- Conteo físico (fija el stock real) y registro de merma (resta lo que se pierde)
- Stock mínimo por producto
- Historial de movimientos por producto (kardex)

**Fuera de alcance (no implementar):**

- Pagos a proveedores y abonos de clientes (módulo de cuentas)
- Cierre de caja, aunque una compra de contado en efectivo salga de la caja (ver 3.4)
- Órdenes de compra, recepción parcial o mercadería pendiente de llegar
- Devoluciones a proveedor
- Transferencias de stock entre sucursales
- Lotes con vencimiento propio y costo promedio ponderado
- Edición de una compra ya registrada: se anula y se vuelve a registrar
- Impuestos desglosados (ISV) y facturación fiscal
- Cambio de precios de venta desde la pantalla de compra

---

## 2. Prerrequisitos

1. **Reutilizar lo ya existente:** `lib/prisma.ts`, `exigirAdministrador()` y `requerirUsuarioActivo()` de `lib/acceso.ts`, los helpers de montos y cantidades de `lib/ventas/calculos.ts`, `lib/fecha.ts` y `formatoMoneda`. Si algún helper de cantidades o montos se usa en ambos módulos y su nombre dice "ventas", moverlo a `lib/` sin cambiar su comportamiento.
2. **Confirmar que la tabla `Compra` está vacía** antes de migrar (la Etapa 1 agrega una columna obligatoria sin valor por defecto).
3. **Ampliar el seed:** un segundo proveedor, una compra de contado y una a crédito con productos de los tres tipos de unidad, para que el saldo por pagar y el último costo tengan datos.

---

## 3. Reglas de negocio (Etapa 1)

### 3.1 Quién compra

- Todo el módulo es solo para `ADMINISTRADOR`, igual que la ruta `/compras` en `lib/permissions.ts`. Las server actions vuelven a validar con `exigirAdministrador()`.
- Sucursal de la compra: la del administrador si tiene una asignada; si no, la que elija en pantalla; si existe una sola, se usa automáticamente. Mismo criterio que la caja (`lib/ventas/sucursal.ts`).

### 3.2 Encabezado de la compra

- **Proveedor:** obligatorio y activo.
- **Fecha:** el día de la factura o de la entrega, no la hora de registro. Por defecto hoy; se acepta hasta 60 días atrás y nunca una fecha futura (en la zona del negocio). Se guarda como el mediodía local de ese día para que no cambie de día al convertir a UTC. La hora real de registro va en `creadoEn`.
- **Número de factura:** opcional, texto libre. Si se repite el mismo número con el mismo proveedor, se muestra una advertencia que no bloquea (puede ser un error de tipeo o una factura dividida).
- **Condición de pago:** `CONTADO` o `CREDITO`. Obligatoria, sin valor por defecto, para que el administrador la elija a conciencia.
- **Notas:** opcional.

### 3.3 Líneas y costos

- Cualquier producto activo se puede comprar a cualquier proveedor. El buscador muestra primero los productos cuyo `proveedorId` es el proveedor elegido.
- El mismo producto no puede aparecer dos veces en una compra; agregarlo de nuevo suma a la línea existente.
- La cantidad se expresa en la **misma unidad de venta del producto** (libras para `PESO`, unidades o paquetes). Si el proveedor entrega por caja o quintal, el administrador convierte antes de cargar. Mismas validaciones que la caja: `PESO` hasta 3 decimales, `UNIDAD` y `PAQUETE` enteros, cantidad mayor que 0 y máximo 99 999 por línea.
- `costoUnitario`: costo por esa unidad, con ISV incluido (lo que efectivamente se paga). Mayor que 0, hasta 2 decimales.
- `subtotal = cantidad × costoUnitario` redondeado a 2 decimales con `ROUND_HALF_UP`; `total` = suma de subtotales. El servidor recalcula todo y descarta los totales que mande el cliente.
- Advertencias que no bloquean, visibles en la línea antes de guardar:
  - el costo es mayor o igual al `precioMinorista` o al `precioMayorista` del producto (se vendería a pérdida);
  - el costo varía más de un 30 % respecto del último costo registrado (posible error de tipeo).
- Opcional por línea: **nueva fecha de vencimiento**. Si se completa, reemplaza `Producto.fechaVencimiento`. No hay lotes: la fecha del producto es una sola.

### 3.4 Condición de pago y cuenta del proveedor

- `CREDITO`: se crea un `MovimientoProveedor` de tipo `CARGO` por el total, enlazado a la compra.
- `CONTADO`: no se crea movimiento. Es el mismo criterio que la caja, donde solo el fiado toca la cuenta del cliente.
- Saldo del proveedor = suma de `CARGO` − suma de `PAGO` − suma de `ANULACION`. Se calcula con una función pura en `lib/compras/saldo.ts`, igual que `lib/ventas/saldo.ts`.
- **Efectivo de la caja:** una compra de contado puede pagarse con el efectivo del mostrador, y eso va a importar en el cierre de caja. En esta etapa no se registra el medio de pago de la compra; cuando se especifique el cierre se decidirá si hace falta. Queda anotado en la sección 9.

### 3.5 Stock y costo

- Al guardar la compra, el stock de cada producto en la sucursal **sube** por la cantidad comprada, de forma atómica y aunque no exista todavía la fila de `Stock` (el mismo `upsert` de la caja, con `increment`).
- Si el stock estaba en negativo (se vendió antes de cargar la mercadería), la compra lo compensa. No se hace nada especial.
- `Producto.costoActual` pasa a ser el `costoUnitario` de esta compra (**último costo**). Si en la misma compra hubiera dos líneas del mismo producto, no aplica: la regla 3.3 lo impide.
- Las líneas se procesan ordenadas por `productoId` para que una compra y una venta simultáneas tomen los bloqueos de stock en el mismo orden, como ya hace `registrar.ts`.

### 3.6 Idempotencia

- Cada formulario de compra genera una `claveIdempotencia` (UUID) al abrirse. Si llega dos veces la misma clave (doble clic, reintento), se devuelve la compra ya registrada sin duplicar stock ni cargo.

### 3.7 Anulación

- Solo administrador, con motivo obligatorio (mínimo 5 caracteres).
- Efectos, en una sola transacción:
  1. crea `AnulacionCompra` y marca `Compra.anulada = true`;
  2. **resta** del stock lo que había sumado cada línea; si el stock queda negativo se permite y se avisa (la mercadería ya se pudo haber vendido);
  3. si la compra era a crédito, crea un `MovimientoProveedor` de tipo `ANULACION` por el total.
- `Producto.costoActual` **no** se recalcula al anular: queda el último valor. Si era incorrecto, se corrige con la próxima compra o editando el producto.
- No se puede anular dos veces. Una compra anulada sigue visible en el listado, tachada y con su motivo.

### 3.8 Fechas, montos y formato

Igual que la caja: timestamps en UTC, día del negocio en `America/Tegucigalpa` con `lib/fecha.ts`, `Prisma.Decimal` en el servidor, strings en JSON y `formatoMoneda` en pantalla.

---

## 4. Cambios de schema (Etapa 1)

```prisma
enum CondicionPago {
  CONTADO
  CREDITO
}

enum TipoMovimientoProveedor {
  CARGO
  PAGO
  /// Reversa del cargo de una compra a crédito anulada. No es dinero pagado.
  ANULACION
}

model Producto {
  // ...campos existentes...
  /// Costo unitario de la última compra registrada. Nulo si nunca se compró.
  costoActual Decimal? @db.Decimal(10, 2)
}

model Compra {
  // ...campos existentes...
  /// Día de la factura (mediodía local). La hora real de registro es `creadoEn`.
  fecha             DateTime
  numeroFactura     String?
  condicionPago     CondicionPago
  notas             String?
  claveIdempotencia String          @unique
  anulada           Boolean         @default(false)
  creadoEn          DateTime        @default(now())
  anulacion         AnulacionCompra?

  @@index([sucursalId, fecha])
  @@index([proveedorId])
}

model DetalleCompra {
  // ...campos existentes...
  subtotal Decimal @db.Decimal(10, 2)
}

model AnulacionCompra {
  id        Int      @id @default(autoincrement())
  compraId  Int      @unique
  compra    Compra   @relation(fields: [compraId], references: [id])
  usuarioId Int
  usuario   Usuario  @relation(fields: [usuarioId], references: [id])
  motivo    String
  fecha     DateTime @default(now())
}

model MovimientoProveedor {
  // ...campos existentes...
  @@index([proveedorId])
}
```

- `Compra.fecha` deja de tener `@default(now())`: siempre la manda la aplicación según 3.2.
- Agregar `anulacionesCompra AnulacionCompra[]` en `Usuario`.
- Nombre sugerido de la migración: `compras_etapa1`.

---

## 5. Pantallas y acciones (Etapa 1)

Se usan **server actions**, como el resto del ABM de administración. La caja usa Route Handlers porque necesita funcionar offline y con escáner; compras no tiene esos requisitos.

### 5.1 `/compras` — listado

- Filtros: rango de fechas (por defecto, los últimos 30 días), proveedor y "incluir anuladas".
- Columnas: fecha, proveedor, número de factura, condición, cantidad de líneas, total y estado.
- Totales del filtro arriba de la tabla: comprado al contado, comprado a crédito.
- Paginación de 50 filas; los filtros se leen con `leerParametros` de `lib/listados.ts`.
- Botón "Nueva compra".

### 5.2 `/compras/nueva` — registrar

- Encabezado: proveedor, fecha, número de factura, condición de pago, notas y sucursal cuando corresponda.
- Buscador de producto por nombre, ID interno o código de barras (el escáner funciona como en caja). Cada línea muestra la unidad, el último costo y los precios de venta para comparar.
- Las advertencias de 3.3 aparecen en la línea, sin bloquear.
- Al guardar, resumen: total, condición y, si es a crédito, el nuevo saldo con el proveedor. Botones "Ver compra" y "Registrar otra".
- Un borrador del formulario se guarda en `localStorage` para no perder una factura larga si se recarga la página; se borra al guardar.

### 5.3 `/compras/[id]` — detalle

- Encabezado, líneas con cantidad, costo y subtotal, quién la registró y cuándo.
- Si está anulada: quién, cuándo y el motivo.
- Botón "Anular" con un diálogo que pide el motivo y explica los efectos (stock y cuenta del proveedor).

### 5.4 Cambios en pantallas existentes

- **Proveedores:** columna "Saldo por pagar" en el listado y, en el detalle, el saldo y las últimas 10 compras con enlace.
- **Productos:** "Último costo" de solo lectura en el formulario y margen sobre el precio minorista, por ejemplo `L 12.00 · margen 25 %`. Sin costo, se muestra "Sin compras".
- **Placeholder de compras:** se reemplaza por el listado.

### 5.5 Lógica de servidor

- `lib/compras/registrar.ts`: valida, recalcula, registra la compra y su detalle, sube el stock, actualiza `costoActual` y la fecha de vencimiento si corresponde, y crea el cargo si es a crédito. Todo en una transacción, ordenado por `productoId`.
- `lib/compras/anular.ts`: anulación según 3.7.
- `lib/compras/saldo.ts`: saldo del proveedor.
- Errores con códigos estables, como en la caja: `PROVEEDOR_INACTIVO`, `PRODUCTO_INACTIVO`, `PRODUCTO_REPETIDO`, `CANTIDAD_INVALIDA`, `COSTO_INVALIDO`, `FECHA_INVALIDA`, `SUCURSAL_REQUERIDA`, `YA_ANULADA`.

---

## 6. Etapa 2 — Inventario y ajustes

No empezar hasta que se confirme la Etapa 1.

### 6.1 Cambios de schema

```prisma
enum TipoAjusteStock {
  /// Conteo físico: se fija la cantidad real y se guarda la diferencia.
  CONTEO
  /// Producto que se pierde: dañado, vencido, robado.
  MERMA
}

model Producto {
  // ...campos existentes...
  /// Debajo de esta cantidad el producto aparece como "stock bajo". Nulo = sin alerta.
  stockMinimo Decimal? @db.Decimal(10, 3)
}

model AjusteStock {
  id              Int             @id @default(autoincrement())
  productoId      Int
  producto        Producto        @relation(fields: [productoId], references: [id])
  sucursalId      Int
  sucursal        Sucursal        @relation(fields: [sucursalId], references: [id])
  usuarioId       Int
  usuario         Usuario         @relation(fields: [usuarioId], references: [id])
  tipo            TipoAjusteStock
  /// Diferencia aplicada al stock: positiva suma, negativa resta.
  cantidad        Decimal         @db.Decimal(10, 3)
  stockAnterior   Decimal         @db.Decimal(10, 3)
  stockResultante Decimal         @db.Decimal(10, 3)
  motivo          String
  fecha           DateTime        @default(now())

  @@index([productoId, sucursalId, fecha])
}
```

- Relaciones inversas en `Producto`, `Sucursal` y `Usuario`.
- Nombre sugerido de la migración: `inventario_etapa2`.

### 6.2 Reglas

- **Conteo:** el administrador escribe la cantidad contada. Dentro de la transacción se bloquea la fila de stock (`SELECT ... FOR UPDATE`), se lee `stockAnterior`, se fija la cantidad contada y se guarda la diferencia en `cantidad`. Si la diferencia es 0, igual se registra: deja constancia de que se contó. El motivo es opcional (por defecto, "Conteo físico").
- **Merma:** se escribe la cantidad perdida (positiva) y se descuenta con `decrement`. El motivo es obligatorio. Puede dejar el stock en negativo, con advertencia.
- Las cantidades siguen las reglas de la unidad del producto (3.3).
- Solo administrador (ver sección 9 para habilitar la merma al empleado).
- **Conteo por lote:** desde la pantalla de inventario se puede activar un "modo conteo" que deja editar la columna de cantidad de varios productos y los guarda juntos, un ajuste por producto modificado, en una transacción. Sirve para cargar el inventario inicial.
- **Ventas sin conexión:** una venta offline cobrada antes de un conteo y sincronizada después descuenta stock que el conteo ya reflejaba. La pantalla de conteo avisa si hay ventas offline sincronizadas en las últimas 24 horas con fecha anterior al último conteo del producto. No se corrige automáticamente.

### 6.3 Pantalla `/inventario`

- Nuevo módulo en `lib/permissions.ts`: `{ href: "/inventario", label: "Inventario", roles: SOLO_ADMIN, grupo: "Gestión" }`, con un ícono nuevo en `components/ui/icono.tsx`.
- Tabla por sucursal: producto, categoría, unidad, stock, stock mínimo, último costo y valor (`stock × costoActual`, solo si el stock es positivo y hay costo).
- Filtros rápidos con contadores: todos, stock bajo (`stock < stockMinimo`), negativo, vencidos o por vencer en 7 días, sin costo.
- Total del inventario valorizado al pie.
- Acciones por fila: "Contar", "Registrar merma" y "Historial".
- El campo `stockMinimo` se edita también en el formulario de producto.

### 6.4 Historial por producto (kardex)

- `/inventario/[productoId]`: movimientos de la sucursal en orden cronológico, con fecha, tipo, cantidad (+/−), usuario, referencia con enlace (venta, compra o ajuste) y saldo acumulado.
- Se arma uniendo las fuentes existentes, sin tabla nueva:
  - `DetalleVenta` de ventas (salida), incluidas las anuladas;
  - `AnulacionVenta` con `reingresaStock` (entrada);
  - `DetalleCompra` (entrada) y `AnulacionCompra` (salida);
  - `AjusteStock` (entrada o salida).
- El saldo acumulado se calcula hacia atrás desde el stock actual, así coincide siempre con la fila de `Stock` aunque haya movimientos anteriores a este módulo. Filtro por rango de fechas, por defecto los últimos 30 días.

---

## 7. Criterios de aceptación

**Etapa 1**

- [ ] Registrar una compra de contado con un producto por peso, uno por unidad y uno por paquete sube el stock de cada uno exactamente lo comprado.
- [ ] Una compra a crédito crea el `CARGO` y aumenta el saldo por pagar del proveedor; una de contado no lo toca.
- [ ] Un producto con stock negativo queda con el stock correcto tras la compra.
- [ ] El último costo del producto pasa a ser el de la compra y se ve en el formulario de producto con su margen.
- [ ] Un costo mayor que el precio de venta muestra la advertencia y permite guardar.
- [ ] Enviar dos veces la misma `claveIdempotencia` no duplica compra, stock ni cargo.
- [ ] Una fecha futura o de hace más de 60 días se rechaza; una compra con fecha de ayer aparece en el día correcto del listado.
- [ ] Anular una compra a crédito resta el stock, crea la `ANULACION` y reduce el saldo del proveedor; no se puede anular de nuevo.
- [ ] Un empleado no puede registrar ni anular compras, ni por la interfaz ni llamando a la acción.
- [ ] Una venta y una compra simultáneas del mismo producto dejan el stock correcto.
- [ ] Recargar `/compras/nueva` conserva el borrador.
- [ ] Typecheck y lint sin errores.

**Etapa 2**

- [ ] Un conteo fija el stock en la cantidad contada y el ajuste guarda la diferencia y el stock anterior.
- [ ] Una merma descuenta el stock y exige motivo.
- [ ] El modo conteo guarda varios productos en un solo paso y solo crea ajustes para los modificados.
- [ ] Los filtros de stock bajo, negativo y vencido muestran los productos correctos y sus contadores coinciden.
- [ ] El historial de un producto muestra ventas, anulaciones, compras y ajustes, y su saldo final coincide con el stock actual.
- [ ] El valor total del inventario coincide con la suma de `stock × costoActual` de las filas con stock positivo.
- [ ] Typecheck y lint sin errores.

---

## 8. Convenciones

- TypeScript estricto, nombres en español y Conventional Commits (`feat(compras): ...`, `feat(inventario): ...`).
- Sin librerías nuevas.
- Las pruebas que escriben datos corren contra una base de desarrollo, nunca contra la de producción en Railway.
- Al terminar cada etapa, no hacer commit sin confirmación, e informar qué se probó de punta a punta, qué no se pudo probar y qué decisiones se tomaron fuera de esta especificación.

---

## 9. Decisiones tomadas por defecto

Se tomaron para no frenar la implementación. Cada una se puede cambiar con poco costo si se decide antes de empezar.

| Decisión | Valor por defecto | Si cambia |
| --- | --- | --- |
| Quién registra compras | Solo administrador | Habilitar al empleado en `permissions.ts` y en las acciones |
| Costo del producto | Último costo | Costo promedio ponderado: guardar también el stock valorizado |
| ISV | Incluido en el costo | Agregar un campo de impuesto por línea |
| Compra de contado | No toca la cuenta del proveedor | Crear `CARGO` y `PAGO` juntos para tener el historial completo |
| Medio de pago de la compra | No se registra | Agregar `metodoPago` si el cierre de caja lo necesita |
| Fecha de la compra | Hasta 60 días atrás, nunca futura | Cambiar el límite en la validación |
| Factura repetida | Advertencia, no bloquea | Volverla única por proveedor |
| Anular compra con stock ya vendido | Se permite, el stock puede quedar negativo | Bloquear si el stock resultante es negativo |
| Costo al anular | No se recalcula | Volver al costo de la compra anterior |
| Quién ajusta stock | Solo administrador | Permitir al empleado registrar merma desde caja |
| Vencimiento | Una fecha por producto, la compra la puede reemplazar | Modelo de lotes |
