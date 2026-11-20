# Sistema para Verdulería — Cierre de caja y cuentas

Especificación del arqueo de caja y de los movimientos de dinero que todavía no existen: abonos de clientes, pagos a proveedores y gastos. Hoy la caja cobra y los saldos de fiado y de proveedores solo suben; este módulo cierra el circuito del dinero.

---

## 1. Alcance y etapas

**Etapa 1 — Cierre de caja.** Se implementa entera y al terminar se detiene el trabajo para revisión.

- Arqueo del efectivo de la caja por sucursal: esperado según el sistema, contado y diferencia
- Fondo que queda en la caja para el turno siguiente
- Resumen de ventas del período por medio de pago
- Bloqueo del cierre mientras el dispositivo tenga ventas sin sincronizar
- Historial de cierres y revisión del administrador

**Etapa 2 — Cuentas y salidas de caja.** No empezar hasta que se confirme la Etapa 1.

- Abonos de clientes a su cuenta de fiado
- Pagos a proveedores
- Gastos
- Los que se pagan o cobran en efectivo de la caja entran en el cierre

**Fuera de alcance (no implementar):**

- Varias cajas abiertas a la vez en la misma sucursal: hay una caja por sucursal
- Apertura de caja como paso separado: el fondo inicial sale del cierre anterior
- Conciliación bancaria de transferencias y tarjetas: se informan, no se cuentan
- Reabrir o editar un cierre: un error se explica en la revisión y se corrige en el cierre siguiente
- Retiros parciales de efectivo durante el turno
- Contabilidad, ISV y libros fiscales

---

## 2. Prerrequisitos

1. Reutilizar `requerirUsuarioActivo()`, `lib/fecha.ts`, `lib/calculos.ts`, `formatoMoneda`, la cola offline (`lib/offline/cola.ts`) y el patrón de errores con código estable de caja y compras.
2. Migración que funcione aunque `CierreCaja` ya tenga filas: las columnas obligatorias nuevas se agregan con un valor de relleno y después se les quita el default.

---

## 3. Reglas de negocio (Etapa 1)

### 3.1 Quién cierra

- **Ambos roles.** El empleado cierra la caja de su sucursal; el administrador también puede hacerlo (si no tiene sucursal, elige cuál).
- Solo el administrador revisa cierres.

### 3.2 Período del cierre

- Un cierre se queda con **todas las ventas de la sucursal que todavía no tienen cierre** (`Venta.cierreCajaId` nulo) y las marca con su id, en la misma transacción. No se delimita por horario: una venta que se guarda en el mismo instante que el cierre entra en este o en el siguiente, nunca en ninguno ni en los dos.
- Lo mismo con las anulaciones de venta (`AnulacionVenta.cierreCajaId`).
- Los cierres de una sucursal forman una cadena: cada uno apunta al anterior. `desde` es el momento del cierre anterior y sirve para mostrar el período.
- El primer cierre de una sucursal solo toma las ventas registradas desde el inicio del día del negocio en que se hace; las anteriores al módulo nunca entran en un cierre. Los siguientes usan ese mismo inicio como piso.
- Si un día no se cerró, el siguiente cierre incluye todo lo pendiente: el efectivo sigue en el cajón.
- Una venta offline entra en el cierre siguiente a su sincronización.

### 3.3 Efectivo esperado

```
esperado = fondoInicial
         + ventas en efectivo del período (no anuladas)
         − devoluciones en efectivo
```

- **Fondo inicial:** el `fondoSiguiente` del cierre anterior. En el primer cierre de la sucursal se escribe a mano.
- **Ventas en efectivo:** `metodoPago = EFECTIVO`, incluidas en este cierre y con `anulada = false` al momento del cierre. Una venta anulada antes de cerrar no suma.
- **Devoluciones:** anulaciones que entran en este cierre de ventas en efectivo que ya estaban en un cierre anterior. Se supone que el dinero se devolvió desde la caja.
- Transferencia, tarjeta y fiado se informan con el mismo criterio, pero no forman parte del esperado.
- El servidor recalcula todo al guardar; lo que muestre la pantalla es una vista previa.

### 3.4 Conteo y diferencia

- Se cuenta el efectivo del cajón: escribiendo el total, o con el detalle de billetes y monedas de Honduras (500, 200, 100, 50, 20, 10, 5, 2 y 1 lempiras; 50, 20 y 10 centavos), que suma solo.
- `diferencia = contado − esperado`. Positiva es sobrante; negativa, faltante.
- **Conteo a ciegas para el empleado:** primero cuenta y después ve el esperado y la diferencia. Puede volver a contar antes de confirmar. El administrador ve el esperado desde el principio.
- Si la diferencia supera **L 20** en valor absoluto, la nota es obligatoria.
- **Fondo siguiente:** cuánto efectivo queda en el cajón para el turno siguiente, entre 0 y lo contado. Lo demás es el **retiro** (`contado − fondoSiguiente`), que se lleva el responsable.

### 3.5 Bloqueos

- **Ventas sin sincronizar:** si el dispositivo tiene ventas en la cola offline, no se puede cerrar. La pantalla lo indica con un enlace a `/caja/pendientes`. Es un control del dispositivo: el servidor no puede ver la cola de otros equipos.
- **Sin conexión:** el cierre necesita el servidor.
- **Cierre simultáneo:** al guardar se bloquea la fila de la sucursal y se compara el cierre anterior con el que vio la pantalla. Si otro usuario cerró en el medio, se rechaza con `CIERRE_DESACTUALIZADO` y la pantalla pide recargar. Además, `cierreAnteriorId` es único.

### 3.6 Idempotencia

Cada pantalla de cierre genera una `claveIdempotencia`. Un doble envío devuelve el cierre ya registrado.

### 3.7 Revisión

- El administrador marca un cierre como revisado, con una nota opcional. Queda quién y cuándo.
- La revisión no cambia los importes.

---

## 4. Cambios de schema (Etapa 1)

```prisma
model CierreCaja {
  id                   Int       @id @default(autoincrement())
  /// Momento del cierre: fin del período.
  fecha                DateTime  @default(now())
  /// Inicio del período: el momento del cierre anterior, o el inicio del día del primero.
  desde                DateTime
  usuarioId            Int
  usuario              Usuario   @relation("CierresRegistrados", fields: [usuarioId], references: [id])
  sucursalId           Int
  sucursal             Sucursal  @relation(fields: [sucursalId], references: [id])
  cierreAnteriorId     Int?      @unique
  cierreAnterior       CierreCaja?  @relation("CadenaCierres", fields: [cierreAnteriorId], references: [id])
  cierreSiguiente      CierreCaja?  @relation("CadenaCierres")
  claveIdempotencia    String    @unique
  fondoInicial         Decimal   @db.Decimal(10, 2)
  ventasEfectivo       Decimal   @db.Decimal(10, 2)
  devolucionesEfectivo Decimal   @db.Decimal(10, 2)
  ventasTransferencia  Decimal   @db.Decimal(10, 2)
  ventasTarjeta        Decimal   @db.Decimal(10, 2)
  ventasFiado          Decimal   @db.Decimal(10, 2)
  cantidadVentas       Int
  /// Efectivo esperado según el sistema.
  totalSistema         Decimal   @db.Decimal(10, 2)
  totalContado         Decimal   @db.Decimal(10, 2)
  /// contado − esperado.
  diferencia           Decimal   @db.Decimal(10, 2)
  /// Efectivo que queda en el cajón para el turno siguiente.
  fondoSiguiente       Decimal   @db.Decimal(10, 2)
  /// Billetes y monedas, si se contó con detalle: { "500": 3, "0.5": 4 }.
  detalleConteo        Json?
  notas                String?
  revisadoPorId        Int?
  revisadoPor          Usuario?  @relation("CierresRevisados", fields: [revisadoPorId], references: [id])
  revisadoEn           DateTime?
  notaRevision         String?

  @@index([sucursalId, fecha])
}
```

- `totalSistema`, `totalContado` y `diferencia` ya existen; el resto es nuevo.
- `Venta` y `AnulacionVenta` reciben `cierreCajaId Int?` (relación con `CierreCaja`) e índices `Venta(sucursalId, cierreCajaId)` y `AnulacionVenta(cierreCajaId)`.
- `Usuario` pasa a tener dos relaciones con `CierreCaja` (`CierresRegistrados` y `CierresRevisados`).
- Nombre sugerido de la migración: `cierre_caja_etapa1`.

---

## 5. Pantallas y acciones (Etapa 1)

### 5.1 `/cierres` — historial

- El administrador ve todos los cierres, con filtro por sucursal y rango de fechas y un filtro rápido "Sin revisar". El empleado ve los cierres de su sucursal de los últimos 30 días.
- Columnas: N°, fecha y hora, sucursal, usuario, esperado, contado, diferencia (sobrante en verde, faltante en rojo) y estado de revisión.
- Botón "Cerrar caja".

### 5.2 `/cierres/nuevo` — cerrar caja

1. **Período y resumen:** desde, cantidad de ventas y totales por medio de pago. El administrador ve además el esperado.
2. **Conteo:** total o detalle de billetes y monedas. Fondo para el turno siguiente.
3. **Confirmación:** esperado, contado, diferencia y retiro. Nota (obligatoria si la diferencia supera L 20). Se puede volver a contar.
4. Resultado con enlace al detalle.

Los bloqueos de 3.5 se muestran antes del paso 1.

### 5.3 `/cierres/[id]` — detalle

Período, usuario, desglose del esperado, ventas por medio de pago, conteo (con billetes y monedas si se usó el detalle), diferencia, fondo y retiro, notas y revisión. El administrador tiene el botón "Marcar como revisado".

### 5.4 Lógica de servidor

- `lib/cierres/calcular.ts`: estado de la caja de una sucursal (cierre anterior, fondo) y totales pendientes, para la vista previa; y totales de un cierre ya asignado.
- `lib/cierres/registrar.ts`: valida, bloquea la sucursal, crea el cierre, le asigna las ventas y anulaciones pendientes, calcula sobre lo asignado y guarda los importes.
- `lib/cierres/revisar.ts`: revisión.
- Errores con código estable: `SIN_PERMISO`, `SUCURSAL_REQUERIDA`, `MONTO_INVALIDO`, `FONDO_INVALIDO`, `NOTA_REQUERIDA`, `CIERRE_DESACTUALIZADO`, `CIERRE_NO_ENCONTRADO`, `YA_REVISADO`.

---

## 6. Etapa 2 — Cuentas y salidas de caja

No empezar hasta que se confirme la Etapa 1.

### 6.1 Abonos de clientes

- Desde `/clientes/[id]` (administrador) y desde la caja (empleado): monto, medio de pago (efectivo, transferencia o tarjeta) y nota opcional.
- Crea un `MovimientoCuenta` de tipo `ABONO`, que pasa a guardar medio de pago, usuario y sucursal.
- No puede superar el saldo adeudado.
- Estado de cuenta del cliente: cargos, abonos y anulaciones con saldo acumulado.
- Comprobante de abono imprimible.

### 6.2 Pagos a proveedores

- Solo administrador, desde `/proveedores/[id]`: monto, medio (efectivo de caja, efectivo fuera de caja, transferencia) y nota.
- Crea un `MovimientoProveedor` de tipo `PAGO`. No puede superar el saldo por pagar.
- Estado de cuenta del proveedor.

### 6.3 Gastos

> Detallado en [Especificacion_Gastos.md](Especificacion_Gastos.md), que manda sobre este resumen.

- `/gastos`: categoría, monto, descripción, sucursal y si se pagó con efectivo de la caja. El empleado puede registrar gastos de caja de su sucursal; el administrador, todos.
- Anulación con motivo (solo administrador).

### 6.4 Integración con el cierre

```
esperado = fondoInicial + ventas en efectivo − devoluciones
         + abonos en efectivo − pagos a proveedores en efectivo de caja − gastos de caja
```

Se agregan las columnas correspondientes a `CierreCaja`, con default 0 para los cierres de la Etapa 1.

---

## 7. Criterios de aceptación

**Etapa 1**

- [ ] El primer cierre de una sucursal pide el fondo inicial; los siguientes lo toman del cierre anterior.
- [ ] El esperado es fondo + ventas en efectivo del período − devoluciones, y coincide con las ventas de la caja.
- [ ] Una venta en efectivo anulada en el mismo período no suma; una de un período ya cerrado anulada en este resta como devolución.
- [ ] Transferencia, tarjeta y fiado se informan y no cambian el esperado.
- [ ] Una venta registrada después de un cierre cuenta en el siguiente, nunca en dos ni en ninguno.
- [ ] El conteo por billetes y monedas suma bien y se guarda el detalle.
- [ ] El empleado no ve el esperado antes de contar; el administrador sí.
- [ ] Una diferencia mayor a L 20 exige nota.
- [ ] Con ventas sin sincronizar en el dispositivo no se puede cerrar.
- [ ] Dos cierres simultáneos de la misma sucursal: uno se guarda y el otro recibe `CIERRE_DESACTUALIZADO`.
- [ ] Enviar dos veces la misma clave no duplica el cierre.
- [ ] Solo el administrador revisa; el empleado no puede ni llamando a la acción.
- [ ] Typecheck y lint sin errores.

---

## 8. Convenciones

- TypeScript estricto, nombres en español y Conventional Commits (`feat(cierres): ...`, `feat(cuentas): ...`).
- Sin librerías nuevas.
- Las pruebas que escriben datos corren contra una base de desarrollo, nunca contra la de producción en Railway.
- Al terminar cada etapa, no hacer commit sin confirmación, e informar qué se probó de punta a punta, qué no se pudo probar y qué decisiones se tomaron fuera de esta especificación.
- **Migraciones:** avisar antes del merge de cualquier PR con migración; la base de Railway tiene que migrarse antes de que Vercel publique el código.

---

## 9. Decisiones tomadas por defecto

| Decisión | Valor por defecto | Si cambia |
| --- | --- | --- |
| Quién cierra | Ambos roles | Restringir en la acción |
| Cajas por sucursal | Una | Agregar un modelo `Caja` y cerrar por caja |
| Qué entra en un cierre | Las ventas sin cierre de la sucursal | Cerrar por día calendario |
| Ventas offline | Entran en el cierre siguiente a su sincronización | Ubicarlas por la fecha de cobro |
| Conteo del empleado | A ciegas, con posibilidad de recontar | Mostrar el esperado desde el principio |
| Umbral de nota | L 20 | Cambiar `DIFERENCIA_CIERRE_NOTA` en `lib/config.ts` |
| Devoluciones de ventas anuladas | Salen del efectivo de la caja | Registrar el medio de devolución en la anulación |
| Compras de contado | No salen de la caja | Etapa 2: un pago a proveedor en efectivo de caja |
| Editar un cierre | No se puede | Agregar "cierre de ajuste" |
