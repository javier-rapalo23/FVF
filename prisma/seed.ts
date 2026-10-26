import { PrismaClient, Rol, TipoCliente, UnidadVenta } from "@prisma/client";
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
