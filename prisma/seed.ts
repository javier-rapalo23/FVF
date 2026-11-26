import {
  CategoriaGasto,
  CondicionPago,
  MedioPagoGasto,
  PrismaClient,
  Rol,
  TipoCliente,
  UnidadVenta,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Contraseña de prueba para los dos usuarios del seed (documentada en el README). */
const PASSWORD_DEMO = "ferrera123";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);

  const sucursal = await prisma.sucursal.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: "Local Principal",
      direccion: "Av. Principal 123",
    },
  });

  await prisma.usuario.upsert({
    where: { email: "admin@ferrera.com" },
    update: {},
    create: {
      nombre: "Administrador",
      email: "admin@ferrera.com",
      passwordHash,
      rol: Rol.ADMINISTRADOR,
      sucursalId: sucursal.id,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "caja@ferrera.com" },
    update: {},
    create: {
      nombre: "Empleado de Caja",
      email: "caja@ferrera.com",
      passwordHash,
      rol: Rol.EMPLEADO_CAJA,
      sucursalId: sucursal.id,
    },
  });

  const nombresCategorias = ["Verduras", "Frutas", "Granos", "Snacks"];
  const categorias = await Promise.all(
    nombresCategorias.map((nombre) =>
      prisma.categoria.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      }),
    ),
  );

  const categoriaPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));

  const proveedor = await prisma.proveedor.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: "Distribuidora del Valle",
      telefono: "+504 2222-3344",
    },
  });

  /*
   * Un producto por cada forma de venta, para probar todos los caminos de la
   * caja: por peso (se tipea la cantidad), por unidad y por paquete con
   * código de barras (se escanean). El aguacate arranca con poco stock para
   * probar la venta con stock negativo, y el yogur ya está vencido.
   */
  const productos = [
    {
      idInterno: 1001,
      codigoBarras: null,
      nombre: "Tomate",
      categoriaId: categoriaPorNombre.get("Verduras")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.PESO,
      precioMinorista: "18.00",
      precioMayorista: "15.00",
      fechaVencimiento: null,
      cantidadStock: "45.500",
    },
    {
      idInterno: 1002,
      codigoBarras: null,
      nombre: "Plátano",
      categoriaId: categoriaPorNombre.get("Frutas")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.PESO,
      precioMinorista: "12.50",
      precioMayorista: "10.00",
      fechaVencimiento: null,
      cantidadStock: "30.000",
    },
    {
      idInterno: 1003,
      codigoBarras: "7401234567890",
      nombre: "Arroz grado 1 - 2 lb",
      categoriaId: categoriaPorNombre.get("Granos")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.PAQUETE,
      precioMinorista: "32.00",
      precioMayorista: "28.50",
      fechaVencimiento: null,
      cantidadStock: "120.000",
    },
    {
      idInterno: 1004,
      codigoBarras: null,
      nombre: "Aguacate",
      categoriaId: categoriaPorNombre.get("Frutas")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.UNIDAD,
      precioMinorista: "15.00",
      precioMayorista: "12.00",
      fechaVencimiento: null,
      cantidadStock: "3.000",
    },
    {
      idInterno: 1005,
      codigoBarras: "7401234500017",
      nombre: "Yogur natural 1 L",
      categoriaId: categoriaPorNombre.get("Snacks")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.UNIDAD,
      precioMinorista: "45.00",
      precioMayorista: "40.00",
      fechaVencimiento: new Date("2026-01-15T00:00:00.000Z"),
      cantidadStock: "10.000",
    },
  ];

  for (const { cantidadStock, ...datosProducto } of productos) {
    const producto = await prisma.producto.upsert({
      where: { idInterno: datosProducto.idInterno },
      update: {},
      create: datosProducto,
    });

    await prisma.stock.upsert({
      where: {
        productoId_sucursalId: {
          productoId: producto.id,
          sucursalId: sucursal.id,
        },
      },
      update: {},
      create: {
        productoId: producto.id,
        sucursalId: sucursal.id,
        cantidad: cantidadStock,
      },
    });
  }

  /*
   * Stock mínimo para probar las alertas de inventario: el aguacate (3 un)
   * queda debajo del suyo. Solo si el producto todavía no tiene uno.
   */
  const minimos: Record<number, string> = { 1001: "20.000", 1003: "24.000", 1004: "10.000" };
  for (const [idInterno, stockMinimo] of Object.entries(minimos)) {
    await prisma.producto.updateMany({
      where: { idInterno: Number(idInterno), stockMinimo: null },
      data: { stockMinimo },
    });
  }

  /*
   * Clientes para probar precios y fiado: mayorista con límite, mayorista sin
   * tope y minorista sin fiado. `Cliente` no tiene otro campo único que el
   * id, así que se buscan por nombre para no duplicarlos ni pisar clientes
   * cargados a mano.
   */
  const clientes = [
    {
      nombre: "María González",
      tipo: TipoCliente.MINORISTA,
      fiadoHabilitado: true,
      limiteCredito: "500.00",
      telefono: "+504 9876-5432",
    },
    {
      nombre: "Comedor Doña Ana",
      tipo: TipoCliente.MAYORISTA,
      fiadoHabilitado: true,
      limiteCredito: "1000.00",
      telefono: "+504 9988-1122",
    },
    {
      nombre: "Supermercado El Centro",
      tipo: TipoCliente.MAYORISTA,
      fiadoHabilitado: true,
      limiteCredito: null,
      telefono: "+504 2233-4455",
    },
    {
      nombre: "Carlos Mejía",
      tipo: TipoCliente.MINORISTA,
      fiadoHabilitado: false,
      limiteCredito: null,
      telefono: null,
    },
  ];

  for (const cliente of clientes) {
    const existente = await prisma.cliente.findFirst({
      where: { nombre: cliente.nombre },
      select: { id: true },
    });
    if (!existente) await prisma.cliente.create({ data: cliente });
  }

  /*
   * Compras de ejemplo: una de contado al proveedor habitual y una a crédito
   * a un segundo proveedor, con productos de las tres unidades. Así el saldo
   * por pagar y el último costo tienen datos desde el primer arranque.
   *
   * No tocan el stock: el stock inicial de arriba ya representa lo que hay en
   * el local. Se identifican por su clave de idempotencia fija, así que el
   * seed no las duplica.
   */
  const proveedorCredito =
    (await prisma.proveedor.findFirst({
      where: { nombre: "Agrícola San Juan" },
    })) ??
    (await prisma.proveedor.create({
      data: { nombre: "Agrícola San Juan", telefono: "+504 9555-0101" },
    }));

  const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: "admin@ferrera.com" } });
  const productoPorIdInterno = new Map(
    (
      await prisma.producto.findMany({
        where: { idInterno: { in: productos.map((p) => p.idInterno) } },
        select: { id: true, idInterno: true },
      })
    ).map((p) => [p.idInterno, p.id]),
  );

  /** Mediodía de Tegucigalpa (18:00 UTC) de hace `dias` días. */
  const mediodiaHace = (dias: number) => {
    const ahora = new Date();
    return new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - dias, 18),
    );
  };

  const compras = [
    {
      claveIdempotencia: "00000000-0000-4000-8000-000000000001",
      proveedorId: proveedor.id,
      condicionPago: CondicionPago.CONTADO,
      numeroFactura: "A-1001",
      fecha: mediodiaHace(3),
      lineas: [
        { idInterno: 1001, cantidad: "50.000", costo: "12.00" },
        { idInterno: 1003, cantidad: "48.000", costo: "24.00" },
        { idInterno: 1005, cantidad: "12.000", costo: "34.00" },
      ],
    },
    {
      claveIdempotencia: "00000000-0000-4000-8000-000000000002",
      proveedorId: proveedorCredito.id,
      condicionPago: CondicionPago.CREDITO,
      numeroFactura: "SJ-0457",
      fecha: mediodiaHace(1),
      lineas: [
        { idInterno: 1002, cantidad: "60.000", costo: "7.50" },
        { idInterno: 1004, cantidad: "40.000", costo: "9.50" },
      ],
    },
  ];

  for (const compra of compras) {
    const existe = await prisma.compra.findUnique({
      where: { claveIdempotencia: compra.claveIdempotencia },
      select: { id: true },
    });
    if (existe) continue;

    const detalles = compra.lineas.map((l) => ({
      productoId: productoPorIdInterno.get(l.idInterno)!,
      cantidad: l.cantidad,
      costoUnitario: l.costo,
      subtotal: (Number(l.cantidad) * Number(l.costo)).toFixed(2),
    }));
    const total = detalles.reduce((suma, d) => suma + Number(d.subtotal), 0).toFixed(2);

    await prisma.$transaction(async (tx) => {
      const creada = await tx.compra.create({
        data: {
          claveIdempotencia: compra.claveIdempotencia,
          proveedorId: compra.proveedorId,
          usuarioId: admin.id,
          sucursalId: sucursal.id,
          fecha: compra.fecha,
          numeroFactura: compra.numeroFactura,
          condicionPago: compra.condicionPago,
          total,
          detalles: { create: detalles },
        },
      });

      if (compra.condicionPago === CondicionPago.CREDITO) {
        await tx.movimientoProveedor.create({
          data: {
            proveedorId: compra.proveedorId,
            compraId: creada.id,
            tipo: "CARGO",
            monto: total,
            fecha: compra.fecha,
          },
        });
      }

      // Solo si el producto todavía no tiene costo: no pisa compras reales.
      for (const d of detalles) {
        await tx.producto.updateMany({
          where: { id: d.productoId, costoActual: null },
          data: { costoActual: d.costoUnitario },
        });
      }
    });
  }

  // Pago parcial por transferencia de la compra a crédito: deja saldo por
  // pagar y no toca ningún cierre de caja.
  const clavePago = "00000000-0000-4000-8000-000000000101";
  if (!(await prisma.movimientoProveedor.findUnique({ where: { claveIdempotencia: clavePago } }))) {
    await prisma.movimientoProveedor.create({
      data: {
        claveIdempotencia: clavePago,
        proveedorId: proveedorCredito.id,
        tipo: "PAGO",
        monto: "300.00",
        medioPago: "TRANSFERENCIA",
        usuarioId: admin.id,
        nota: "Pago parcial factura SJ-0457",
      },
    });
  }

  // ---------------------------------------------------------------- Gastos
  // Los conceptos los carga la migración `gastos_etapa1`; el upsert solo cubre
  // una base armada sin migraciones.
  const concepto = async (nombre: string, categoria: CategoriaGasto) =>
    (
      await prisma.conceptoGasto.upsert({
        where: { nombre },
        update: {},
        create: { nombre, categoria },
        select: { id: true },
      })
    ).id;

  // Gastos fijos (Etapa 2): uno de la sucursal y uno general, ligado al recibo
  // de luz de abajo para que el resumen muestre uno registrado.
  const gastoFijo = async (datos: {
    conceptoId: number;
    descripcion: string;
    montoEstimado: string;
    diaDelMes: number;
    medioPago: MedioPagoGasto;
    sucursalId: number | null;
  }) =>
    (
      (await prisma.gastoFijo.findFirst({ where: { descripcion: datos.descripcion }, select: { id: true } })) ??
      (await prisma.gastoFijo.create({ data: datos, select: { id: true } }))
    ).id;

  await gastoFijo({
    conceptoId: await concepto("Alquiler", CategoriaGasto.OPERATIVO),
    descripcion: "Alquiler del local",
    montoEstimado: "12000.00",
    diaDelMes: 5,
    medioPago: MedioPagoGasto.TRANSFERENCIA,
    sucursalId: sucursal.id,
  });
  const fijoLuz = await gastoFijo({
    conceptoId: await concepto("Energía eléctrica", CategoriaGasto.OPERATIVO),
    descripcion: "Recibo de energía (ENEE)",
    montoEstimado: "1800.00",
    diaDelMes: 20,
    medioPago: MedioPagoGasto.TRANSFERENCIA,
    sucursalId: null,
  });

  const gastos = [
    {
      // Gasto de caja de hoy: resta en el próximo cierre de la sucursal.
      claveIdempotencia: "00000000-0000-4000-8000-000000000101",
      conceptoId: await concepto("Hielo", CategoriaGasto.MERCADERIA),
      monto: "150.00",
      medioPago: MedioPagoGasto.EFECTIVO_CAJA,
      descripcion: "Hielo para la verdura de hoja",
      sucursalId: sucursal.id,
      fecha: mediodiaHace(0),
      anulacion: null,
    },
    {
      // Gasto general, sin sucursal, pagado por transferencia.
      claveIdempotencia: "00000000-0000-4000-8000-000000000102",
      conceptoId: await concepto("Energía eléctrica", CategoriaGasto.OPERATIVO),
      monto: "1850.40",
      medioPago: MedioPagoGasto.TRANSFERENCIA,
      descripcion: "Recibo ENEE del mes",
      sucursalId: null,
      fecha: mediodiaHace(5),
      gastoFijoId: fijoLuz,
      anulacion: null,
    },
    {
      claveIdempotencia: "00000000-0000-4000-8000-000000000103",
      conceptoId: await concepto("Fletes y transporte", CategoriaGasto.MERCADERIA),
      monto: "400.00",
      medioPago: MedioPagoGasto.EFECTIVO_FUERA_CAJA,
      descripcion: "Flete de Comayagua",
      sucursalId: sucursal.id,
      fecha: mediodiaHace(2),
      anulacion: "Registrado dos veces",
    },
  ];

  for (const { anulacion, ...gasto } of gastos) {
    const existe = await prisma.gasto.findUnique({
      where: { claveIdempotencia: gasto.claveIdempotencia },
      select: { id: true },
    });
    if (existe) continue;

    await prisma.gasto.create({
      data: {
        ...gasto,
        usuarioId: admin.id,
        anulado: anulacion !== null,
        ...(anulacion ? { anulacion: { create: { usuarioId: admin.id, motivo: anulacion } } } : {}),
      },
    });
  }

  console.log("Seed completado.");
  console.log(`Usuarios: admin@ferrera.com / caja@ferrera.com  (password: ${PASSWORD_DEMO})`);
}

main()
  .catch((error) => {
    console.error("Error en el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
