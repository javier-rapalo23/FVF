import { prisma } from "@/lib/prisma";

/**
 * Categorías y proveedores para los selects del formulario de producto.
 *
 * Solo se ofrecen proveedores activos, salvo el que el producto ya tiene
 * asignado: si se lo omitiera, guardar el producto le borraría el proveedor.
 */
export function opcionesProducto(proveedorActualId: number | null = null) {
  return Promise.all([
    prisma.categoria.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.proveedor.findMany({
      where: {
        OR: [{ activo: true }, ...(proveedorActualId ? [{ id: proveedorActualId }] : [])],
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
}
