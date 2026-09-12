import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { aNumero } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { CajaPos } from "./_components/caja-pos";

export const metadata: Metadata = { title: "Caja / Ventas | Inversiones Ferrera" };

export default async function CajaPage() {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");

  // Un usuario sin sucursal asignada (caso posible según el schema) cae en la
  // primera sucursal: la caja siempre opera contra un stock concreto.
  const sucursalId =
    sesion.user.sucursalId ??
    (await prisma.sucursal.findFirst({ orderBy: { id: "asc" }, select: { id: true } }))
      ?.id ??
    null;

  if (sucursalId === null) {
    return (
      <p className="text-sm text-tinta-media">
        No hay ninguna sucursal cargada. Ejecutá el seed antes de abrir la caja.
      </p>
    );
  }

  const [productos, clientes, sucursal] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      select: {
        id: true,
        idInterno: true,
        nombre: true,
        codigoBarras: true,
        unidadVenta: true,
        precioMinorista: true,
        precioMayorista: true,
        categoria: { select: { nombre: true } },
        stock: { where: { sucursalId }, select: { cantidad: true } },
      },
      orderBy: [{ categoria: { nombre: "asc" } }, { nombre: "asc" }],
    }),
    prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, tipo: true, limiteCredito: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.sucursal.findUnique({
      where: { id: sucursalId },
      select: { nombre: true },
    }),
  ]);

  // Los `Decimal` de Prisma no cruzan el límite servidor/cliente: se aplanan
  // a number acá, que además es lo que necesita el carrito para sumar.
  return (
    <CajaPos
      sucursal={sucursal?.nombre ?? "Sucursal"}
      productos={productos.map((producto) => ({
        id: producto.id,
        idInterno: producto.idInterno,
        nombre: producto.nombre,
        codigoBarras: producto.codigoBarras,
        categoria: producto.categoria.nombre,
        unidadVenta: producto.unidadVenta,
        precioMinorista: aNumero(producto.precioMinorista.toString()),
        precioMayorista: aNumero(producto.precioMayorista.toString()),
        stock: producto.stock[0] ? aNumero(producto.stock[0].cantidad.toString()) : 0,
      }))}
      clientes={clientes.map((cliente) => ({
        id: cliente.id,
        nombre: cliente.nombre,
        tipo: cliente.tipo,
        limiteCredito: cliente.limiteCredito
          ? aNumero(cliente.limiteCredito.toString())
          : null,
      }))}
    />
  );
}
