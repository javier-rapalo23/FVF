# Sistema para Verdulería — Módulo de gastos

Especificación para registrar los gastos del negocio: alquiler, luz, salarios, fletes, bolsas y todo lo que no es mercadería que entra al stock. Hoy `/gastos` es un placeholder y el modelo `Gasto` existe pero nadie lo usa. Este módulo agrega el registro, la clasificación, la anulación y la salida del efectivo de la caja, que el cierre todavía no descuenta.

Desarrolla la sección 6.3 de [Especificacion_Cierre_Cuentas.md](Especificacion_Cierre_Cuentas.md) y la parte de gastos de la 6.4. Si algo de este documento contradice esas secciones, vale este documento. Los abonos de clientes y los pagos a proveedores siguen en esa especificación.

---

## 1. Alcance y etapas

**Etapa 1 — Registro de gastos y cierre de caja.** Se implementa entera y al terminar se detiene el trabajo para revisión.

- Conceptos de gasto administrables, agrupados en las tres categorías existentes
- Registro de gastos con concepto, monto, medio de pago, sucursal y descripción
- El empleado registra gastos pagados con el efectivo de la caja de su sucursal
- Los gastos de caja restan del efectivo esperado en el cierre
- Listado con filtros y totales, detalle, corrección de datos descriptivos y anulación con motivo

**Etapa 2 — Resumen y gastos fijos.** No empezar hasta que se confirme que la Etapa 1 está validada.

- Resumen mensual por categoría, concepto y sucursal, comparado con el mes anterior
- Gastos fijos (alquiler, salarios, servicios) con aviso de los que faltan registrar en el mes
- Exportación del listado a CSV

**Fuera de alcance (no implementar):**

- Compras de mercadería que entra al stock: van por Compras, aunque se paguen con el efectivo de la caja (ver 3.2)
- Pagos a proveedores y abonos de clientes (módulo de cuentas)
- Estado de resultados, márgenes y utilidad del período: los arma el módulo de Reportes con lo que expone `lib/gastos/resumen.ts`
- Gastos a crédito o cuentas por pagar de gastos: un gasto se registra cuando se paga
- Adjuntar fotos o archivos de comprobantes: solo se guarda el número
- ISV, crédito fiscal y libros contables
- Presupuestos, aprobaciones y reembolsos a empleados
- Prorrateo de un gasto entre sucursales
- Caja chica separada del cajón de ventas

---

## 2. Prerrequisitos

1. **Reutilizar lo ya existente:** `exigirAdministrador()` y `requerirUsuarioActivo()` de `lib/acceso.ts`; `leerFormulario` de `lib/formulario.ts` (incluye `textoLargo` para textos de varias líneas); `diaDelNegocio`, `mediodiaDelDia` y `sumarDias` de `lib/fecha.ts`; `redondearMonto` y `textoMonto` de `lib/calculos.ts`; `formatoMoneda`; `sucursalDePantalla` de `lib/sucursal.ts`; `leerParametros` de `lib/listados.ts`; y el patrón de errores con código estable de caja, compras y cierres.
2. **Confirmar que la tabla `Gasto` está vacía** antes de migrar. La Etapa 1 quita la columna `categoria` y agrega columnas obligatorias sin valor por defecto. Ninguna pantalla ni el seed escriben gastos hoy, así que debería estarlo. Si no lo está, avisar antes de seguir.
3. **Ampliar el seed:** un gasto de caja de la sucursal principal, uno por transferencia sin sucursal y uno anulado, para que el listado, los totales y el cierre tengan datos.

---

## 3. Reglas de negocio (Etapa 1)

### 3.1 Quién registra

- **Administrador:** registra cualquier gasto, de cualquier sucursal o general (sin sucursal), con cualquier medio de pago. Corrige, anula y administra los conceptos.
- **Empleado de caja:** solo registra gastos con medio `EFECTIVO_CAJA` en su sucursal, con fecha de hoy. Ve los gastos de su sucursal de los últimos 30 días. No corrige ni anula.
- La ruta `/gastos` pasa a ser de ambos roles. `/gastos/conceptos` sigue siendo solo de administrador (ver 5.5). Las server actions vuelven a validar el rol y la sucursal en cada llamada: no alcanza con ocultar botones.

### 3.2 Conceptos y categorías

- Cada gasto tiene un **concepto** (`ConceptoGasto`). Cada concepto pertenece a una de las tres categorías que ya existen en el enum `CategoriaGasto`. La categoría del gasto sale de su concepto: no se guarda en el gasto.
- Significado de cada categoría:
  - `OPERATIVO`: lo que cuesta mantener abierto el local (alquiler, servicios, salarios, limpieza, mantenimiento, combustible).
  - `MERCADERIA`: costos ligados a la mercadería que **no entran al stock** (fletes, bolsas y empaques, hielo, carga y descarga). La mercadería que se vende se registra en Compras: cargarla como gasto contaría dos veces su costo y no subiría el stock. El formulario lo recuerda con una nota bajo el selector cuando se elige un concepto de esta categoría.
  - `ADMINISTRATIVO`: papelería, contador, impuestos y permisos municipales, comisiones bancarias.
- Nombre único sin distinguir mayúsculas, hasta 60 caracteres. Un concepto con gastos no se borra: se desactiva y deja de ofrecerse, pero conserva su historial.
- Cambiar la categoría de un concepto reclasifica todos sus gastos, también los pasados. La pantalla lo advierte antes de guardar.
- La migración carga los conceptos iniciales (sección 4), así producción los tiene sin depender del seed.

### 3.3 Datos del gasto

- **Concepto:** obligatorio y activo.
- **Monto:** mayor que 0, hasta 2 decimales, con el mismo tope que el resto de los montos (`Decimal(10, 2)`). Es lo que efectivamente se pagó, con ISV incluido.
- **Descripción:** obligatoria, de 3 a 250 caracteres. Dice qué se pagó exactamente, por ejemplo "Recibo ENEE octubre" o "Flete de Comayagua". Es lo que permite revisar el gasto después.
- **Número de comprobante:** opcional, texto libre de hasta 60 caracteres (factura, recibo).
- **Fecha:** el día en que se pagó, no la hora de registro. Mismo criterio que las compras: por defecto hoy, hasta `DIAS_ATRAS_COMPRA` (60) días atrás y nunca una fecha futura en la zona del negocio. Se guarda como el mediodía local de ese día. La hora real de registro va en `creadoEn`. Los gastos de caja tienen otra regla (3.4).

### 3.4 Medio de pago y sucursal

| Medio | Qué significa | Sucursal | Fecha | Afecta el cierre |
| --- | --- | --- | --- | --- |
| `EFECTIVO_CAJA` | Sale del cajón de ventas de la sucursal | Obligatoria | Siempre hoy | Sí, resta del esperado |
| `EFECTIVO_FUERA_CAJA` | Efectivo que no sale del cajón (lo pone el dueño, caja fuerte) | Opcional | Hasta 60 días atrás | No |
| `TRANSFERENCIA` | Desde una cuenta bancaria | Opcional | Hasta 60 días atrás | No |
| `TARJETA` | Con tarjeta del negocio | Opcional | Hasta 60 días atrás | No |

- Sin sucursal, el gasto es **general** de la empresa, por ejemplo el contador. En listados y resúmenes aparece como "General".
- Sucursal del gasto de caja: la del usuario si tiene una asignada. Si no tiene (un administrador), la elige en pantalla. Si existe una sola, se usa automáticamente. Mismo criterio que caja y compras.
- **Un gasto de caja siempre es de hoy.** El dinero sale del cajón ahora y se descuenta en el próximo cierre. Si se olvidó registrar un gasto de caja de un período ya cerrado, ese cierre ya mostró el faltante. En ese caso se registra con medio `EFECTIVO_FUERA_CAJA` y la fecha real, para que cuente en los gastos sin tocar el próximo cierre, y la explicación va en la revisión de aquel cierre.
- **Aviso de efectivo insuficiente:** si un administrador registra un gasto de caja mayor que el efectivo esperado en ese momento (vista previa del cierre), se muestra una advertencia que no bloquea. Al empleado **no** se le hace este chequeo: mostrárselo le revelaría el esperado y rompería el conteo a ciegas del cierre.
- **Sin conexión:** registrar un gasto necesita el servidor, igual que el cierre. La caja offline sigue cobrando, pero el botón de gasto indica que hace falta conexión. No se encola.

### 3.5 Integración con el cierre de caja

Fórmula del esperado:

```
esperado = fondoInicial
         + ventas en efectivo del período (no anuladas)
         − devoluciones en efectivo
         − gastos de caja del período (no anulados)
```

Cuando se implementen los abonos de clientes y los pagos a proveedores (cuentas, Etapa 2), se suman a esta misma fórmula.

- El cierre se queda con **todos los gastos de caja de la sucursal que todavía no tienen cierre** (`Gasto.cierreCajaId` nulo, `medioPago = EFECTIVO_CAJA`, registrados desde el piso de la cadena). Los marca con su id en la misma transacción en que asigna las ventas. Igual que con las ventas, un gasto que se guarda en el mismo instante que el cierre entra en este o en el siguiente, nunca en ninguno ni en los dos.
- Se asignan también los gastos de caja anulados antes del cierre, pero no restan, igual que una venta anulada en el mismo período.
- **Gasto anulado después de su cierre:** no cambia ese cierre (ya se contó el cajón con lo que había) ni genera un movimiento en el siguiente. Si el dinero en realidad no había salido, el cierre ya mostró un sobrante y se explica en su revisión.
- `CierreCaja` guarda el total en una columna nueva, `gastosCaja`. Los cierres anteriores a este módulo quedan en 0.
- El empleado ve el total de gastos de caja en el resumen del cierre (son gastos que él mismo registró), pero sigue sin ver el esperado hasta que cuenta.

### 3.6 Idempotencia

Cada formulario de gasto genera una `claveIdempotencia` (UUID) al abrirse. Si llega dos veces la misma clave (doble clic, reintento), se devuelve el gasto ya registrado sin duplicarlo.

### 3.7 Corrección y anulación

- **Corrección (solo administrador):** se pueden cambiar el concepto, la descripción y el número de comprobante. Esos datos no mueven dinero ni tocan ningún cierre. El monto, el medio, la sucursal y la fecha no se editan: si están mal, se anula y se registra de nuevo. Mismo criterio que las compras.
- **Anulación (solo administrador):** motivo obligatorio, de 5 caracteres como mínimo. En una transacción, crea `AnulacionGasto` y marca `Gasto.anulado = true`, bloqueando antes la fila del gasto (`SELECT ... FOR UPDATE`). Así no se cruza con un cierre que esté asignando ese mismo gasto.
- La pantalla de anulación explica el efecto según el caso:
  - gasto de caja sin cierre: "deja de restar en el próximo cierre";
  - gasto de caja ya cerrado: "el cierre N° X no cambia";
  - gasto de otro medio: "solo deja de contar en los gastos del período".
- No se puede anular dos veces. Un gasto anulado sigue visible en el listado, tachado y con su motivo, y no suma en ningún total.

### 3.8 Fechas, montos y formato

Igual que caja y compras: timestamps en UTC, día del negocio en `America/Tegucigalpa` con `lib/fecha.ts`, `Prisma.Decimal` en el servidor, strings en JSON y `formatoMoneda` en pantalla.

---

## 4. Cambios de schema (Etapa 1)

```prisma
enum MedioPagoGasto {
  /// Sale del cajón de ventas de la sucursal: resta en el cierre de caja.
  EFECTIVO_CAJA
  /// Efectivo que no sale del cajón (lo pone el dueño, caja fuerte).
  EFECTIVO_FUERA_CAJA
  TRANSFERENCIA
  TARJETA
}

model ConceptoGasto {
  id        Int            @id @default(autoincrement())
  nombre    String         @unique
  categoria CategoriaGasto
  activo    Boolean        @default(true)
  gastos    Gasto[]
}

model Gasto {
  id                Int             @id @default(autoincrement())
  /// Día del pago (mediodía local). La hora real de registro es `creadoEn`.
  fecha             DateTime
  conceptoId        Int
  concepto          ConceptoGasto   @relation(fields: [conceptoId], references: [id])
  monto             Decimal         @db.Decimal(10, 2)
  medioPago         MedioPagoGasto
  descripcion       String
  numeroComprobante String?
  usuarioId         Int
  usuario           Usuario         @relation(fields: [usuarioId], references: [id])
  /// Nula = gasto general de la empresa. Obligatoria si se pagó con efectivo de caja.
  sucursalId        Int?
  sucursal          Sucursal?       @relation(fields: [sucursalId], references: [id])
  /// Generada al abrir el formulario: un doble envío no duplica el gasto.
  claveIdempotencia String          @unique
  anulado           Boolean         @default(false)
  anulacion         AnulacionGasto?
  /// Cierre que lo descontó del efectivo. Solo gastos de caja; nulo = pendiente.
  cierreCajaId      Int?
  cierreCaja        CierreCaja?     @relation(fields: [cierreCajaId], references: [id])
  creadoEn          DateTime        @default(now())

  @@index([fecha])
  @@index([sucursalId, cierreCajaId])
  @@index([conceptoId])
}

model AnulacionGasto {
  id        Int      @id @default(autoincrement())
  gastoId   Int      @unique
  gasto     Gasto    @relation(fields: [gastoId], references: [id])
  usuarioId Int
  usuario   Usuario  @relation(fields: [usuarioId], references: [id])
  motivo    String
  fecha     DateTime @default(now())
}

model CierreCaja {
  // ...campos existentes...
  /// Gastos pagados con el efectivo del cajón en este período.
  gastosCaja Decimal @default(0) @db.Decimal(10, 2)
  gastos     Gasto[]
}
```

- `Gasto.categoria` desaparece: la categoría sale del concepto. `Gasto.fecha` deja de tener `@default(now())`, porque siempre la manda la aplicación según 3.3 y 3.4.
- Agregar `anulacionesGasto AnulacionGasto[]` en `Usuario`.
- La migración inserta los conceptos iniciales:

| Categoría | Conceptos |
| --- | --- |
| `OPERATIVO` | Alquiler · Energía eléctrica · Agua · Internet y teléfono · Salarios y jornales · Limpieza · Mantenimiento y reparaciones · Combustible |
| `MERCADERIA` | Fletes y transporte · Bolsas y empaques · Hielo · Carga y descarga |
| `ADMINISTRATIVO` | Papelería · Contador y asesoría · Impuestos y permisos municipales · Comisiones bancarias · Otros gastos |

- Nombre sugerido de la migración: `gastos_etapa1`.

---

## 5. Pantallas y acciones (Etapa 1)

Se usan **server actions**, como compras y el ABM de administración. No hace falta funcionar sin conexión (3.4).

### 5.1 `/gastos` — listado

- Filtros: rango de fechas (por defecto, el mes en curso), sucursal (incluye "General"), categoría, concepto, medio de pago e "incluir anulados". El empleado no ve los filtros de sucursal ni de medio: solo ve los gastos de caja de su sucursal de los últimos 30 días.
- Columnas: fecha, concepto con su categoría como etiqueta, descripción, sucursal, medio, registrado por, monto y estado. En móvil se ocultan la sucursal y el usuario.
- Totales del filtro arriba de la tabla: total y desglose por categoría. Los anulados no suman.
- Paginación de 50 filas.
- Botones: "Nuevo gasto" y, solo para el administrador, "Conceptos".

### 5.2 `/gastos/nuevo` — registrar

- Campos: concepto (agrupado por categoría), monto, medio de pago, sucursal cuando corresponda, fecha, descripción y número de comprobante.
- Para el empleado, el formulario se reduce a concepto, monto, descripción y comprobante. El medio, la sucursal y la fecha vienen fijos y se muestran como texto: "Efectivo de caja · Sucursal Centro · hoy".
- Al elegir `EFECTIVO_CAJA` se fija la fecha en hoy, la sucursal pasa a ser obligatoria y aparece la nota "Se descuenta en el próximo cierre de caja".
- La nota de 3.2 aparece cuando el concepto es de mercadería. La advertencia de efectivo insuficiente (3.4) aparece solo al administrador.
- Al guardar se vuelve al listado con el aviso "se guardó correctamente" y el botón "Registrar otro".

### 5.3 `/gastos/[id]` — detalle

- Todos los datos: quién lo registró y cuándo (`creadoEn`), y para los de caja, el cierre en el que entró (con enlace) o "Pendiente del próximo cierre".
- Si está anulado: quién, cuándo y el motivo.
- Botones del administrador: "Editar", que abre `/gastos/[id]/editar` con concepto, descripción y comprobante (3.7), y "Anular", con un diálogo que pide el motivo y explica el efecto según 3.7.

### 5.4 `/gastos/conceptos` — conceptos

- Solo administrador. Pestañas "Gastos / Conceptos", como "Productos / Categorías".
- Tabla agrupada por categoría: nombre, cantidad de gastos y estado. Alta y edición en línea (nombre, categoría, activo), con la advertencia de 3.2 al cambiar la categoría de un concepto con gastos.

### 5.5 Cambios en pantallas existentes

- **Permisos (`lib/permissions.ts`):** `/gastos` pasa a `TODOS`. `moduloDeRuta` hoy devuelve la primera coincidencia por prefijo: cambiarlo para que devuelva la **más larga**, y agregar `{ href: "/gastos/conceptos", roles: SOLO_ADMIN, oculto: true }`. El campo nuevo `oculto` evita que aparezca en la navegación. El middleware sigue siendo el único chequeo de rutas.
- **Cierre de caja:**
  - el resumen de `/cierres/nuevo` muestra la línea "Gastos de caja" con su total y cantidad;
  - el detalle `/cierres/[id]` agrega "− Gastos de caja" en el desglose del esperado y la lista de gastos incluidos, con enlace;
  - `lib/cierres/calcular.ts` suma los gastos en `totalesPendientes` y `totalesDeCierre`, y `TotalesCierre` gana el campo `gastosCaja`;
  - `lib/cierres/registrar.ts` asigna los gastos pendientes en la misma transacción que las ventas.
- **Caja:** un botón "Registrar gasto" en la pantalla de caja abre `/gastos/nuevo`. Sin conexión aparece deshabilitado con el motivo.
- **Placeholder de gastos:** se reemplaza por el listado.

### 5.6 Lógica de servidor

- `lib/gastos/registrar.ts`: valida según el rol, resuelve la sucursal, aplica la regla de fecha y crea el gasto. Si la clave ya existe, devuelve el gasto anterior.
- `lib/gastos/anular.ts`: anulación según 3.7.
- `lib/gastos/conceptos.ts`: alta y edición de conceptos.
- Errores con códigos estables: `SIN_PERMISO`, `SUCURSAL_REQUERIDA`, `CONCEPTO_INACTIVO`, `MONTO_INVALIDO`, `FECHA_INVALIDA`, `MEDIO_NO_PERMITIDO`, `DESCRIPCION_REQUERIDA`, `GASTO_NO_ENCONTRADO`, `YA_ANULADO`, `CONCEPTO_DUPLICADO`.

---

## 6. Etapa 2 — Resumen y gastos fijos

No empezar hasta que se confirme la Etapa 1.

### 6.1 Cambios de schema

```prisma
model GastoFijo {
  id            Int             @id @default(autoincrement())
  conceptoId    Int
  concepto      ConceptoGasto   @relation(fields: [conceptoId], references: [id])
  descripcion   String
  /// Monto de referencia: el real se escribe al registrar el gasto.
  montoEstimado Decimal         @db.Decimal(10, 2)
  /// Día del mes en que se suele pagar, de 1 a 28.
  diaDelMes     Int
  medioPago     MedioPagoGasto
  sucursalId    Int?
  sucursal      Sucursal?       @relation(fields: [sucursalId], references: [id])
  activo        Boolean         @default(true)
  gastos        Gasto[]
}

model Gasto {
  // ...campos de la Etapa 1...
  gastoFijoId Int?
  gastoFijo   GastoFijo? @relation(fields: [gastoFijoId], references: [id])
}
```

- Nombre sugerido de la migración: `gastos_etapa2`.

### 6.2 `/gastos/resumen`

- Solo administrador. Selector de mes, por defecto el actual, y de sucursal (todas, una o "General").
- Total del mes y variación contra el mes anterior, en monto y porcentaje.
- Por categoría: total y porcentaje del mes, con barras horizontales hechas con CSS (sin librerías).
- Por concepto: tabla con el mes, el mes anterior y la diferencia, ordenada por monto.
- Por sucursal: total de cada una y de "General".
- Los números salen de `lib/gastos/resumen.ts` (`resumenDeGastos(db, { desde, hasta, sucursalId })`), que también va a usar el módulo de Reportes. Los anulados nunca suman.

### 6.3 Gastos fijos

- Alta y edición en una pestaña "Fijos" de `/gastos`: concepto, descripción, monto estimado, día del mes, medio y sucursal.
- El resumen muestra los gastos fijos del mes con su estado:
  - **Registrado:** existe un gasto no anulado del mes con ese `gastoFijoId`.
  - **Pendiente:** todavía no llegó el día.
  - **Atrasado:** ya pasó el día y no se registró.
- El botón "Registrar" abre `/gastos/nuevo?fijo=<id>` con concepto, descripción, medio, sucursal y monto estimado ya cargados. El monto se puede cambiar.
- Nada se registra solo: un gasto fijo es un recordatorio con plantilla, no un débito automático.

### 6.4 Exportación

- Botón "Exportar CSV" en el listado: exporta las filas del filtro actual, sin paginar. Columnas: fecha, concepto, categoría, descripción, comprobante, sucursal, medio, usuario, monto y estado.
- Se arma en un Route Handler con separador `;` y BOM UTF-8, para que Excel en español lo abra con tildes y columnas bien separadas. Sin librerías.

---

## 7. Criterios de aceptación

**Etapa 1**

- [ ] El administrador registra un gasto general por transferencia con fecha de hace 10 días, y aparece en ese día del listado.
- [ ] Una fecha futura o de hace más de 60 días se rechaza. Un gasto de caja no acepta otra fecha que hoy.
- [ ] El empleado solo puede registrar gastos de caja de su sucursal. Llamar a la acción con otro medio u otra sucursal devuelve `MEDIO_NO_PERMITIDO` o `SIN_PERMISO`.
- [ ] El empleado entra a `/gastos` pero no a `/gastos/conceptos`, y no ve "Conceptos" en la navegación ni en la pantalla.
- [ ] Un gasto de caja de L 150 baja en L 150 el esperado del próximo cierre de esa sucursal y no cambia el de otra sucursal.
- [ ] Un gasto de caja registrado después de un cierre cuenta en el siguiente, nunca en dos ni en ninguno.
- [ ] Un gasto de caja anulado antes del cierre no resta. Uno anulado después de su cierre no cambia ese cierre ni el siguiente.
- [ ] Los gastos por transferencia, tarjeta o efectivo fuera de caja no cambian el esperado.
- [ ] El detalle del cierre muestra "Gastos de caja" en el desglose y la lista de gastos incluidos.
- [ ] Los cierres hechos antes de este módulo muestran gastos de caja en 0 y su esperado no cambia.
- [ ] El empleado no ve el esperado ni recibe el aviso de efectivo insuficiente al registrar un gasto.
- [ ] Enviar dos veces la misma clave no duplica el gasto.
- [ ] Corregir el concepto o la descripción de un gasto no cambia ningún monto ni ningún cierre.
- [ ] Anular exige motivo, deja el gasto tachado en el listado y no permite anularlo de nuevo. El empleado no puede anular, ni llamando a la acción.
- [ ] Los totales del listado coinciden con la suma de los gastos no anulados del filtro, y el desglose por categoría suma el total.
- [ ] Un concepto desactivado no se ofrece al registrar, pero sus gastos siguen visibles y filtrables.
- [ ] Typecheck y lint sin errores.

**Etapa 2**

- [ ] El resumen de un mes coincide con el total del listado filtrado por ese mes, y la variación contra el mes anterior es correcta.
- [ ] Un gasto fijo pasa de "Pendiente" a "Atrasado" después de su día, y a "Registrado" al registrar un gasto desde su botón.
- [ ] Un gasto fijo registrado y después anulado vuelve a figurar como pendiente o atrasado.
- [ ] El CSV abre en Excel con tildes correctas, una columna por campo y las mismas filas que el filtro.
- [ ] Typecheck y lint sin errores.

---

## 8. Convenciones

- TypeScript estricto, nombres en español y Conventional Commits (`feat(gastos): ...`, `feat(cierres): ...`).
- Sin librerías nuevas.
- Las pruebas que escriben datos corren contra una base de desarrollo, nunca contra la de producción en Railway.
- Al terminar cada etapa, no hacer commit sin confirmación, e informar qué se probó de punta a punta, qué no se pudo probar y qué decisiones se tomaron fuera de esta especificación.
- **Migraciones:** avisar antes del merge de cualquier PR con migración. La base de Railway tiene que migrarse (`npm run db:deploy`) antes de que Vercel publique el código.

---

## 9. Decisiones tomadas por defecto

Se tomaron para no frenar la implementación. Cada una se puede cambiar con poco costo si se decide antes de empezar.

| Decisión | Valor por defecto | Si cambia |
| --- | --- | --- |
| Quién registra | Administrador todo; empleado solo gastos de caja de su sucursal | Ajustar la validación por rol en `registrar.ts` |
| Tope de monto para el empleado | Sin tope; se controla en la revisión del cierre | Agregar `MONTO_MAXIMO_GASTO_EMPLEADO` en `lib/config.ts` |
| Clasificación | Conceptos administrables dentro de tres categorías fijas | Categorías administrables: reemplazar el enum por una tabla |
| Descripción | Obligatoria | Volverla opcional salvo en "Otros gastos" |
| Fecha | Hasta 60 días atrás y nunca futura; los de caja, siempre hoy | Cambiar el límite en la validación |
| Gasto de caja olvidado de un período cerrado | Se registra como efectivo fuera de caja | Un "ajuste de cierre" que lo descuente en el siguiente |
| Gasto de caja anulado después de su cierre | No cambia ningún cierre | Reintegrarlo como entrada en el cierre siguiente |
| Corrección | Concepto, descripción y comprobante; el resto se anula | Permitir editar el monto de gastos que no son de caja |
| Quién anula | Solo administrador | Permitir al empleado anular el suyo mientras no tenga cierre |
| Aviso de efectivo insuficiente | Solo al administrador | Bloquear el gasto en vez de avisar |
| Gastos sin conexión | No se pueden registrar | Encolarlos como las ventas offline |
| Comprobante | Solo el número | Almacenamiento de archivos para fotos |
| Gasto sin sucursal | Permitido, figura como "General" | Hacer la sucursal siempre obligatoria |
| Mercadería pagada con efectivo de caja | No es un gasto: va por Compras y, en cuentas, por pago a proveedor | — |
| Gastos fijos | Recordatorio con plantilla, sin registro automático | Generar el gasto solo el día indicado |
