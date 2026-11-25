import { prisma } from "@/lib/prisma";

/** Conceptos activos (más el actual aunque se haya desactivado) y sucursales del formulario. */
export async function opcionesGastoFijo(conceptoActual?: number) {
  return Promise.all([
    prisma.conceptoGasto.findMany({
      where: conceptoActual ? { OR: [{ activo: true }, { id: conceptoActual }] } : { activo: true },
      select: { id: true, nombre: true, categoria: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } }),
  ]);
}
