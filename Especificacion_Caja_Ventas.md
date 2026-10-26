# Sistema para Verdulería — Módulo de caja/ventas

Especificación para implementar el módulo de caja/ventas sobre la base del proyecto y el CRUD de datos maestros ya construidos. Es el módulo más crítico del sistema: tiene que ser rápido para el empleado, exacto con el dinero y, en la Etapa 2, seguir vendiendo cuando se cae internet.

---

## 1. Alcance y etapas

**Etapa 1 — Caja online completa.** Se implementa entera y al terminar se detiene el trabajo para revisión.

- Pantalla de caja con búsqueda y escaneo de código de barras
- Registro de venta de local y de pedido, con precio según tipo de cliente
- Cobro en efectivo, transferencia, tarjeta o fiado
- Descuento de stock por sucursal
- Comprobante interno imprimible
- Listado y detalle de ventas del día
- Anulación de ventas (solo administrador)

**Etapa 2 — Resiliencia offline.** No empezar hasta que se confirme que la Etapa 1 está validada (ver sección 8). La Etapa 1 ya deja resueltas las bases: catálogo cargado en el cliente y clave de idempotencia por venta.

**Fuera de alcance (no implementar):**

- Cierre de caja, abonos a cuentas de clientes, pagos a proveedores, compras
- Reportes
- Pago mixto en una misma venta (dos métodos)
- Descuentos manuales o edición de precios desde caja
- Aplicación automática de cantidades mínimas mayoristas
- Ajustes de inventario y registro de merma
- Impresora térmica específica o facturación fiscal

---

## 2. Prerrequisitos

1. **Migraciones pendientes del CRUD**, aplicar antes de empezar si todavía no están:
   - `Cliente.fiadoHabilitado Boolean @default(false)`
   - `Proveedor.activo Boolean @default(true)`
2. **Ajuste del CRUD de clientes:** agregar el checkbox "Fiado habilitado" y dejar el límite de crédito como opcional, con el texto de ayuda "vacío = sin tope". Solo el administrador puede modificar ambos. Esto reemplaza la regla anterior de "límite vacío = sin fiado".
3. **Reutilizar lo ya existente:** el cliente de Prisma (`lib/prisma.ts`), la sesión de Auth.js y el patrón de `lib/acceso.ts`. Agregar ahí `requerirUsuarioActivo()`: verifica en la base de datos que el usuario existe y está activo, y devuelve su rol y `sucursalId`. Es la misma idea que la validación de administrador: no confiar solo en lo que dice la sesión.
4. **Ampliar el seed** para poder probar todos los caminos:
   - Productos: uno por `PESO`, uno por `UNIDAD` y uno por `PAQUETE` con código de barras, con stock inicial en la sucursal
   - Clientes: un mayorista con fiado habilitado y límite, un mayorista con fiado sin tope, un minorista sin fiado

---

## 3. Reglas de negocio

### 3.1 Precios

- Precio de la línea: `precioMayorista` si el cliente es `MAYORISTA`; en cualquier otro caso (cliente `MINORISTA` o venta sin cliente), `precioMinorista`.
- El servidor decide el precio. El cliente lo calcula con la misma función pura (`lib/ventas/precios.ts`) solo para mostrarlo.
- El `precioUnitario` se guarda en `DetalleVenta` como foto del momento de la venta.
- Cambiar el cliente del carrito recalcula todas las líneas.
- La cantidad mínima mayorista no se aplica: manda el tipo de cliente.

### 3.2 Cantidades y unidades

- `PESO`: decimal positivo, hasta 3 decimales. La etiqueta de la unidad sale de `lib/config.ts` (`UNIDAD_PESO`, valor inicial `"lb"`), nunca escrita a mano en los componentes.
- `UNIDAD` y `PAQUETE`: enteros mayores o iguales a 1.
- Máximo 9999 por línea, para frenar errores de tipeo.
- Los productos inactivos no aparecen en caja ni se pueden vender.
- Un producto con `fechaVencimiento` pasada sigue siendo vendible, pero la línea muestra una advertencia visual. No bloquea.

### 3.3 Canal

- `LOCAL`: venta de mostrador; el cliente es opcional.
- `PEDIDO`: registro manual de un pedido recibido por WhatsApp o llamada; el cliente es obligatorio y hay un campo `notas` (dirección, indicaciones). Usa el mismo flujo de cobro y fiado que el local y descuenta stock al registrarse, no al entregarse.

### 3.4 Métodos de pago y fiado

- Un solo método por venta: `EFECTIVO`, `TRANSFERENCIA`, `TARJETA` o `FIADO`.
- En efectivo, la pantalla calcula el vuelto a partir del monto recibido. El vuelto no se guarda.
- `FIADO` exige un cliente activo con `fiadoHabilitado = true`.
- Saldo del cliente = suma de `CARGO` − suma de `ABONO` − suma de `ANULACION` en `MovimientoCuenta`.
- Si el cliente tiene `limiteCredito` y `saldo + total` lo supera:
  - `EMPLEADO_CAJA`: la venta se rechaza con `LIMITE_CREDITO_EXCEDIDO`.
  - `ADMINISTRADOR`: la pantalla muestra el exceso y pide confirmación; si confirma, se reenvía con `confirmarExcesoCredito: true`.
- Un `limiteCredito` vacío significa sin tope.
- Una venta a fiado crea un `MovimientoCuenta` de tipo `CARGO` por el total, enlazado a la venta.

### 3.5 Stock

- El descuento ocurre al registrar la venta, en la sucursal de la venta, tanto en `LOCAL` como en `PEDIDO`.
- Sucursal de la venta: para `EMPLEADO_CAJA`, siempre la de su usuario (se ignora lo que mande el cliente). Para `ADMINISTRADOR` sin sucursal asignada, la que elija en pantalla; si existe una sola, se usa automáticamente.
- **Se permite vender con stock negativo.** Mientras el inventario inicial no esté cargado y la rotación sea alta, bloquear la venta pararía el mostrador. En su lugar:
  - la línea del carrito muestra una marca roja cuando la cantidad supera el stock conocido;
  - la respuesta de la API incluye una advertencia `STOCK_NEGATIVO` por producto afectado;
  - el resultado de la venta lo muestra al empleado.
- El descuento debe ser atómico y no fallar si todavía no existe la fila de `Stock`:

```ts
tx.stock.upsert({
  where: { productoId_sucursalId: { productoId, sucursalId } },
  update: { cantidad: { decrement: cantidad } },
  create: { productoId, sucursalId, cantidad: cantidad.neg() },
})
```

- No se crea tabla de movimientos de stock en esta etapa; la trazabilidad sale de `DetalleVenta`. El módulo de stock agregará los ajustes con motivo.

### 3.6 Anulación

- Solo `ADMINISTRADOR`. Requiere un motivo (mínimo 3 caracteres) y que indique si el producto vuelve físicamente al stock.
- La venta no puede estar ya anulada. Solo se anula completa, no por línea.
- Efectos, todos en una misma transacción:
  1. Crear el registro `AnulacionVenta`.
  2. Marcar `Venta.anulada = true`.
  3. Si `reingresaStock`: incrementar el stock de cada línea en la sucursal de la venta.
  4. Si la venta era `FIADO`: crear un `MovimientoCuenta` de tipo `ANULACION` por el total, enlazado a la venta. Se usa un tipo propio y no `ABONO` para que una anulación no se confunda con dinero cobrado cuando exista el cierre de caja.
- Una venta nunca se borra. Las anuladas quedan visibles con su marca y se excluyen de los totales.
- Cuando exista el cierre de caja habrá que definir qué pasa al anular una venta de un día ya cerrado. Por ahora se permite y queda registrado.

### 3.7 Dinero y redondeo

- Usar siempre `Prisma.Decimal` para montos y cantidades; nunca `number`.
- En la API los decimales viajan como strings.
- `subtotal = cantidad × precioUnitario`, redondeado a 2 decimales (`ROUND_HALF_UP`). `total` = suma de subtotales.
- El servidor recalcula todo y descarta cualquier total que envíe el cliente.
- Formato de pantalla en lempiras con un helper único `formatoMoneda`: `L 1,234.50`.

### 3.8 Fechas y zona horaria

- Los timestamps se guardan en UTC. La zona del negocio es `America/Tegucigalpa` (UTC−6, sin horario de verano).
- "Hoy" es el día calendario en esa zona. Vercel corre en UTC, así que **nunca** usar `new Date().setHours(0,0,0,0)` para calcular el día: una venta de las 18:00 locales ya es del día siguiente en UTC.
- Crear `lib/fecha.ts` con `inicioYFinDelDia(fecha)` en la zona del negocio, y formatear horas con `Intl.DateTimeFormat` indicando `timeZone`.

---

## 4. Cambios de schema (Etapa 1)

```prisma
enum TipoMovimientoCuenta {
  CARGO
  ABONO
  ANULACION
}

model Venta {
  // ...campos existentes...
  claveIdempotencia String   @unique
  notas             String?
  creadoEn          DateTime @default(now())
  anulacion         AnulacionVenta?

  @@index([sucursalId, fecha])
}

model AnulacionVenta {
  id             Int      @id @default(autoincrement())
  ventaId        Int      @unique
  venta          Venta    @relation(fields: [ventaId], references: [id])
  usuarioId      Int
  usuario        Usuario  @relation(fields: [usuarioId], references: [id])
  motivo         String
  reingresaStock Boolean
  fecha          DateTime @default(now())
}

model MovimientoCuenta {
  // ...campos existentes...
  @@index([clienteId])
}
```

- Agregar `anulaciones AnulacionVenta[]` en `Usuario`.
- Nombre sugerido de la migración: `caja_ventas_etapa1`.
- `claveIdempotencia` es obligatoria y sin valor por defecto. Verificar que la tabla `Venta` esté vacía antes de migrar; si tuviera filas, resolverlo con una migración manual.
- Se conserva `Venta.anulada` como bandera para filtrar rápido.

---

## 5. API

Todos los endpoints son Route Handlers que exigen un usuario activo (`requerirUsuarioActivo()`), aplican el rol que corresponda y responden JSON. Respetar la versión de Next.js instalada en cuanto a la forma de leer `params`.

### 5.1 `GET /api/caja/catalogo`

Entrega todo lo que la pantalla de caja necesita para trabajar sin más consultas. Es la base de la Etapa 2.

- Parámetro opcional `sucursalId`, solo válido para `ADMINISTRADOR` sin sucursal asignada.
- Incluye únicamente productos y clientes activos.
- El saldo de cada cliente se calcula con una sola consulta agrupada sobre `MovimientoCuenta`, no una por cliente.
- Header `Cache-Control: no-store`.

```jsonc
{
  "sucursal": { "id": 1, "nombre": "Local Principal" },
  "generadoEn": "2026-10-25T18:00:00.000Z",
  "productos": [
    {
      "id": 5, "idInterno": 1004, "codigoBarras": "7401234567890",
      "nombre": "Tomate", "categoria": { "id": 1, "nombre": "Verduras" },
      "unidadVenta": "PESO",
      "precioMinorista": "18.00", "precioMayorista": "15.00",
      "fechaVencimiento": null,
      "stock": "42.500"
    }
  ],
  "clientes": [
    {
      "id": 12, "nombre": "Comedor Doña Ana", "tipo": "MAYORISTA",
      "fiadoHabilitado": true, "limiteCredito": "5000.00", "saldo": "1250.00"
    }
  ]
}
```

### 5.2 `POST /api/ventas`

```jsonc
{
  "claveIdempotencia": "uuid-v4",          // generada en el cliente por cada carrito
  "canal": "LOCAL",                         // LOCAL | PEDIDO
  "clienteId": 12,                          // null permitido solo en LOCAL
  "metodoPago": "FIADO",                    // EFECTIVO | TRANSFERENCIA | TARJETA | FIADO
  "sucursalId": 1,                          // solo lo considera un ADMINISTRADOR sin sucursal
  "notas": "Entregar antes de las 11",      // opcional
  "confirmarExcesoCredito": false,          // solo lo considera un ADMINISTRADOR
  "items": [
    { "productoId": 5, "cantidad": "2.500" }
  ]
}
```

Orden de procesamiento:

1. Usuario activo y rol.
2. Validación del payload (estructura, cantidades según unidad, máximo por línea).
3. Chequeo de idempotencia: si ya existe una venta con esa `claveIdempotencia`, responder `200` con los datos de la venta original y `yaRegistrada: true`, sin tocar nada.
4. Resolución de la sucursal.
5. Carga de productos activos y del cliente; reglas de canal y de fiado (sección 3).
6. Transacción única (`prisma.$transaction`): crear `Venta` y `DetalleVenta`, descontar stock línea por línea y, si es fiado, crear el `CARGO`.
7. Capturar el error de unicidad (`P2002`) sobre `claveIdempotencia` por si dos reintentos llegan a la vez, y tratarlo como el caso 3.

Respuesta `201`:

```jsonc
{
  "ventaId": 123,
  "total": "85.50",
  "yaRegistrada": false,
  "advertencias": [
    { "tipo": "STOCK_NEGATIVO", "productoId": 5, "stockResultante": "-1.000" }
  ]
}
```

Errores, siempre con la forma `{ "error": "CODIGO", "mensaje": "texto para mostrar", ...datos }`:

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `SIN_SESION` | 401 | No hay sesión válida o el usuario está inactivo |
| `PAYLOAD_INVALIDO` | 400 | Estructura incorrecta |
| `CANTIDAD_INVALIDA` | 400 | Cantidad fuera de regla para la unidad del producto |
| `SUCURSAL_REQUERIDA` | 400 | Administrador sin sucursal y sin una elegida |
| `PRODUCTO_NO_DISPONIBLE` | 422 | Producto inexistente o inactivo |
| `CLIENTE_REQUERIDO` | 422 | `PEDIDO` o `FIADO` sin cliente |
| `CLIENTE_INACTIVO` | 422 | El cliente está desactivado |
| `FIADO_NO_HABILITADO` | 422 | El cliente no tiene fiado habilitado |
| `LIMITE_CREDITO_EXCEDIDO` | 422 | Incluir `saldo`, `limite` y `total` en la respuesta |

El chequeo del límite de crédito se hace dentro de la transacción. Dos ventas a fiado simultáneas al mismo cliente pueden pasarse del límite por un margen mínimo; se acepta por ahora.

### 5.3 `POST /api/ventas/[id]/anular`

- Solo `ADMINISTRADOR`.
- Body: `{ "motivo": "texto", "reingresaStock": true }`.
- Aplica los efectos de la sección 3.6.
- Errores: venta inexistente (404), venta ya anulada (409), motivo inválido (400).

El listado y el detalle de ventas son Server Components que consultan con Prisma; no necesitan endpoints propios.

---

## 6. Pantallas

### 6.1 `/caja` — pantalla de venta

Pensada para un puesto de mostrador (escritorio o tablet con lector USB) y usable desde el celular del administrador. En pantallas anchas va en dos columnas (búsqueda y líneas a la izquierda, cliente, total y cobro a la derecha); en celular, apiladas. Debe poder operarse casi sin mouse.

**Búsqueda y escaneo**

- Un único campo de búsqueda, siempre enfocado: al cargar la pantalla, después de agregar un producto y después de cerrar cualquier diálogo.
- Los lectores USB y Bluetooth se comportan como teclado: escriben el código y terminan con Enter. Al presionar Enter:
  1. Coincidencia exacta con `codigoBarras`.
  2. Si no, coincidencia exacta con `idInterno`.
  3. Si no, se muestra una lista de resultados por nombre, navegable con flechas y Enter.
- Código no registrado: aviso claro en pantalla y el campo vuelve a quedar enfocado. No se crean productos desde caja.
- Enter nunca debe enviar el formulario ni cobrar.
- Búsqueda por nombre sin acentos ni mayúsculas, sobre el catálogo ya cargado en memoria (instantánea).
- Producto `UNIDAD` o `PAQUETE`: se agrega con cantidad 1; escanear el mismo producto de nuevo suma 1 a la línea existente.
- Producto `PESO`: se agrega la línea y el foco pasa al campo de cantidad (peso ingresado a mano, con la etiqueta `UNIDAD_PESO`); Enter confirma y devuelve el foco a la búsqueda. Dos pesadas del mismo producto pueden ser dos líneas.

**Líneas del carrito**

- Columnas: producto, cantidad editable, precio unitario, subtotal y botón para quitar.
- Marca roja si la cantidad supera el stock conocido (no bloquea) y advertencia si el producto está vencido.

**Cliente y canal**

- Selector con búsqueda por nombre, con "Sin cliente" por defecto en `LOCAL`.
- Al elegir un cliente se muestran su tipo (mayorista o minorista), su saldo y si tiene fiado habilitado.
- Interruptor `LOCAL` / `PEDIDO`. En `PEDIDO` se exige cliente y aparece el campo `notas`.

**Cobro**

- Total grande y visible. Selector de método de pago con `EFECTIVO` por defecto.
- Efectivo: campo "Recibido" y vuelto calculado.
- `FIADO` aparece deshabilitado con el motivo cuando no hay cliente o el cliente no tiene fiado habilitado. Si el límite se excede, el empleado ve el bloqueo; el administrador ve el diálogo de confirmación.
- Botón "Cobrar" deshabilitado mientras la petición está en curso. Un reintento reutiliza la misma `claveIdempotencia`; una venta nueva genera una clave nueva (`crypto.randomUUID()`).

**Resultado**

- Pantalla de confirmación con número de venta, total y las advertencias (por ejemplo stock negativo).
- Acciones: "Imprimir comprobante" y "Nueva venta". "Nueva venta" es la acción por defecto con Enter y devuelve el foco a la búsqueda.

**Carrito en curso**

- Se conserva ante una recarga accidental en `localStorage`, con la clave por usuario, envuelto en `try/catch`. Guardar solo `claveIdempotencia`, `clienteId`, `canal`, `notas` y los pares `productoId` + `cantidad`; los precios se recalculan siempre desde el catálogo.

**Datos del catálogo**

- Se carga `GET /api/caja/catalogo` al abrir la pantalla y se refresca cada 60 segundos mientras haya conexión. Tras cada venta se actualizan localmente el stock y el saldo del cliente.

**Atajos recomendados:** `F2` enfoca la búsqueda, `F4` abre el cobro, `Esc` cierra diálogos.

### 6.2 `/caja/ventas` — ventas del día

- Lista de las ventas de la sucursal para el día actual (zona del negocio): número, hora, cliente, método de pago, total, usuario y estado.
- Las anuladas se muestran con una marca visible.
- El administrador puede cambiar la fecha. El empleado solo ve el día actual.

### 6.3 `/caja/ventas/[id]` — detalle y comprobante

- Detalle completo y comprobante interno con estilos de impresión (`@media print`), ancho cercano a 80 mm, botón "Imprimir" con `window.print()`.
- Contenido del comprobante: nombre del negocio y sucursal (constantes en `lib/config.ts`), número, fecha y hora local, cajero, cliente, líneas con cantidad, unidad, precio y subtotal, total y método de pago.
- Pie fijo: "Comprobante interno, no válido como factura". Si la venta está anulada, una marca visible.
- El botón "Anular" aparece solo para el administrador y abre un diálogo con motivo obligatorio y la pregunta "¿El producto vuelve al stock?".

---

## 7. Estructura de archivos sugerida

```
/app/(dashboard)/caja
  page.tsx                    -> Server Component: valida sesión y renderiza <PantallaCaja />
  ventas/page.tsx
  ventas/[id]/page.tsx
  _components/
    PantallaCaja.tsx          -> client component
    BuscadorProducto.tsx
    LineasCarrito.tsx
    SelectorCliente.tsx
    PanelCobro.tsx
    ResultadoVenta.tsx
    Comprobante.tsx
/app/api/caja/catalogo/route.ts
/app/api/ventas/route.ts
/app/api/ventas/[id]/anular/route.ts
/lib/ventas
  precios.ts                  -> precio según tipo de cliente
  calculos.ts                 -> subtotal, total, redondeo
  saldo.ts                    -> saldo de cliente
  registrar.ts                -> servicio transaccional de venta
  anular.ts                   -> servicio transaccional de anulación
  tipos.ts
/lib/fecha.ts
/lib/config.ts                -> UNIDAD_PESO, NOMBRE_NEGOCIO
```

La lógica de negocio vive en `lib/ventas` y los Route Handlers solo validan, llaman al servicio y responden. Las funciones puras (precio, subtotal, total, saldo) deben quedar aisladas para poder probarlas.

---

## 8. Etapa 2 — Resiliencia offline

No empezar hasta que se confirme la Etapa 1. Objetivo: el empleado sigue cobrando si se cae internet y nada se pierde ni se duplica al volver la conexión.

### 8.1 Cambios de schema

```prisma
model Venta {
  // ...campos existentes + los de la Etapa 1...
  origenOffline    Boolean @default(false)
  requiereRevision Boolean @default(false)
  observacionSync  String?
}
```

### 8.2 PWA

- Manifest y service worker que cacheen la estructura de `/caja` y los archivos estáticos, con navegación "red primero" y respaldo en la versión cacheada.
- Evaluar `@serwist/next`; si da fricción con App Router, escribir a mano un `public/sw.js` mínimo. Justificar la elección.
- Sin conexión no corre el middleware (la petición ni sale), así que la pantalla de caja debe poder abrirse con la sesión que ya existe y el catálogo guardado.

### 8.3 Almacenamiento local (IndexedDB)

Se justifica la librería `idb` por la verbosidad de IndexedDB nativo. Tres almacenes:

- `catalogo`: la última respuesta de `GET /api/caja/catalogo` con su fecha.
- `ventasPendientes`: clave `claveIdempotencia`; contiene el payload completo, `usuarioId` del vendedor, `sucursalId`, `fechaCliente`, estado (`PENDIENTE`, `SINCRONIZANDO`, `ERROR`), intentos y último error.
- `carrito`: opcional, si se prefiere sacarlo de `localStorage`.

### 8.4 Registrar una venta sin conexión

- Si el `fetch` falla por red o excede un tiempo de espera (por ejemplo 8 segundos), la venta pasa a la cola. No confiar solo en `navigator.onLine`.
- Reintentar con la misma clave es seguro: si la primera petición sí llegó al servidor, la idempotencia devuelve la venta original.
- La pantalla de resultado muestra un estado distinto y visible: "Guardada sin conexión, pendiente de sincronizar", con el comprobante marcado como pendiente (el número definitivo lo asigna el servidor).
- Se actualizan localmente stock y saldo del catálogo cacheado.

### 8.5 Sincronización

- La sincroniza la propia aplicación, no Background Sync (no está disponible en Safari/iOS). Disparadores: evento `online`, carga de página, intervalo de 15 segundos mientras haya cola y la pestaña esté visible, y botón manual "Sincronizar ahora".
- Orden FIFO, una venta a la vez. Si el servidor responde 2xx, o `yaRegistrada: true`, se quita de la cola. Si falla por red o 5xx, se reintenta con espera creciente.
- Un error `400` o `403` no se descarta jamás: la venta pasa a estado `ERROR` y queda visible hasta que alguien la resuelva.
- Un `401` conserva la cola intacta y pide volver a iniciar sesión.

### 8.6 Reglas del servidor para ventas offline

El payload suma `origenOffline: true`, `fechaCliente`, `usuarioIdOrigen` y `precioUnitario` por línea.

- Las ventas offline **siempre se registran**: el producto ya salió del local. Las reglas que dependen del estado actual no bloquean; la venta se guarda con `requiereRevision = true` y una `observacionSync` que explica el motivo. Casos: límite de crédito excedido, fiado deshabilitado desde la última sincronización del catálogo, cliente o producto desactivado.
- Siguen siendo errores duros (`400`, la venta queda en la cola con estado `ERROR`): un `productoId` o `clienteId` inexistente, cantidades inválidas o falta de sucursal.
- Fecha: se usa `fechaCliente` solo si está entre 7 días atrás y 5 minutos adelante respecto del servidor; si no, se usa la hora del servidor y se marca `requiereRevision`.
- Precios: se acepta el precio del cliente, porque es lo que el cliente pagó. Si algún precio no coincide con el precio minorista o mayorista vigente del producto, se marca `requiereRevision`.
- Vendedor: `usuarioIdOrigen` conserva quién vendió. Si no coincide con el usuario de la sesión que sincroniza, solo se acepta cuando esa sesión es `ADMINISTRADOR`; de lo contrario se rechaza con `403` y la venta espera en la cola a que sincronice su vendedor o un administrador.

### 8.7 Interfaz

- Indicador permanente de conexión ("En línea" / "Sin conexión") y contador de ventas pendientes.
- Pantalla `/caja/pendientes` con las ventas en cola y sus estados, con "Reintentar" y "Descargar respaldo (JSON)". "Descartar" solo para el administrador y con descarga de respaldo previa.
- Aviso al cerrar sesión si hay ventas sin sincronizar: se conservan en el dispositivo.
- Marca visible de "requiere revisión" en el listado de ventas para el administrador.

### 8.8 Límites que se aceptan en offline

- No se pueden anular ventas, ni crear clientes o productos.
- El stock y el saldo para validar fiado son los del último catálogo cacheado y pueden estar desactualizados.
- Cuando exista el cierre de caja, deberá bloquearse mientras haya ventas sin sincronizar.

---

## 9. Criterios de aceptación

**Etapa 1**

- [ ] Escanear un producto empaquetado lo agrega al carrito sin tocar el mouse; escanearlo otra vez suma 1.
- [ ] Un producto por peso permite escribir el peso y confirmar con Enter; el foco vuelve a la búsqueda.
- [ ] El mismo carrito da precios distintos con un cliente mayorista, uno minorista y sin cliente.
- [ ] Vender a fiado descuenta stock, crea el `CARGO` y aumenta el saldo mostrado del cliente.
- [ ] Cliente sin fiado habilitado: la opción `FIADO` queda bloqueada con su motivo.
- [ ] Exceder el límite: el empleado queda bloqueado y el administrador puede confirmar.
- [ ] Un `PEDIDO` sin cliente se rechaza; con cliente se registra con sus notas y descuenta stock.
- [ ] Enviar dos veces la misma `claveIdempotencia` no duplica venta, stock ni cargo.
- [ ] Vender con stock insuficiente permite la venta y muestra la advertencia.
- [ ] Anular una venta a fiado con reingreso de stock restaura el stock y reduce el saldo con un movimiento `ANULACION`.
- [ ] El empleado no puede anular, ni por la interfaz ni llamando al endpoint.
- [ ] Una venta de las 18:00 hora local aparece en el día correcto de `/caja/ventas`.
- [ ] El comprobante se imprime limpio y dice que no es factura.
- [ ] Recargar la página conserva el carrito en curso.
- [ ] Typecheck y lint sin errores.

**Etapa 2**

- [ ] Con la red cortada desde las herramientas del navegador, se abre `/caja` y se cobra una venta.
- [ ] Al volver la conexión, la venta se sincroniza sola una única vez.
- [ ] Cortar la red justo al enviar y reintentar no duplica la venta.
- [ ] Una venta offline a fiado que excede el límite se registra con `requiereRevision`.
- [ ] Una venta con error duro queda visible y recuperable; no se pierde.
- [ ] Un `401` conserva la cola y se reanuda tras iniciar sesión.
- [ ] Sincronizar la venta de otro vendedor con un empleado distinto se rechaza; con un administrador se acepta.

---

## 10. Decisiones tomadas por defecto

Se tomaron estas decisiones para no frenar la implementación. Cada una se puede cambiar con poco costo.

| Decisión | Valor por defecto | Si cambia |
| --- | --- | --- |
| Stock negativo | Permitido, con advertencia | Bloquear al llegar a cero en `registrar.ts` |
| Quién anula | Solo administrador | Habilitar el rol de caja en el endpoint y la interfaz |
| Métodos de pago por venta | Uno solo | Requiere una tabla de pagos por venta |
| Pedido sin cliente | No permitido | Quitar la regla `CLIENTE_REQUERIDO` en `PEDIDO` |
| Cantidad mínima mayorista | No se aplica | Definir primero la regla (por producto o por total) |
| Edición de precio en caja | No existe | Agregar un permiso de administrador por línea |
| Unidad de peso | `lb`, configurable en `lib/config.ts` | Cambiar una constante |
| Exceso de crédito | Empleado bloqueado, administrador confirma | Cambiar la regla en `registrar.ts` |
| Venta offline con reglas incumplidas | Se registra y se marca para revisión | Rechazarla (no recomendado: el producto ya salió) |
| Comprobante | Vista imprimible simple | Integrar impresora térmica más adelante |

---

## 11. Convenciones

- TypeScript estricto, nombres en español y commits con Conventional Commits, igual que en el resto del proyecto (por ejemplo `feat(caja): ...`).
- No agregar librerías fuera del stack. Excepción prevista: en la Etapa 2, `idb` y la solución de service worker elegida, ambas justificadas.
- Las pruebas que escriben datos (ventas, anulaciones) deben correr contra una base de desarrollo. Si solo está disponible la base principal de Railway, no escribir en ella sin autorización: dejar un guion de pruebas manuales.
- Al terminar cada etapa, no hacer commit sin confirmación e informar qué se probó de punta a punta, qué no se pudo probar y qué decisiones se tomaron fuera de esta especificación.
