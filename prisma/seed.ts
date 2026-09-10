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
      telefono: "+56 9 1234 5678",
    },
  });

  const productos = [
    {
      idInterno: 1001,
      codigoBarras: null,
      nombre: "Tomate",
      categoriaId: categoriaPorNombre.get("Verduras")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.PESO,
      precioMinorista: "1890.00",
      precioMayorista: "1490.00",
      cantidadStock: "45.500",
    },
    {
      idInterno: 1002,
      codigoBarras: null,
      nombre: "Plátano",
      categoriaId: categoriaPorNombre.get("Frutas")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.PESO,
      precioMinorista: "1290.00",
      precioMayorista: "990.00",
      cantidadStock: "30.000",
    },
    {
      idInterno: 1003,
      codigoBarras: "7801234567890",
      nombre: "Arroz grado 1 - 1kg",
      categoriaId: categoriaPorNombre.get("Granos")!,
      proveedorId: proveedor.id,
      unidadVenta: UnidadVenta.PAQUETE,
      precioMinorista: "1690.00",
      precioMayorista: "1390.00",
      cantidadStock: "120.000",
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

  await prisma.cliente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: "María González",
      tipo: TipoCliente.MINORISTA,
      limiteCredito: "50000.00",
      telefono: "+56 9 8765 4321",
    },
  });

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
