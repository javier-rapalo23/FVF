import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

export type SucursalBasica = { id: number; nombre: string };

/**
 * Sucursal que muestra una pantalla de gestión (inventario, cierres).
 *
 * - Usuario con sucursal asignada: la suya; el parámetro se ignora.
 * - Sin sucursal: la del parámetro `?sucursal=`, o la primera. Solo tiene
 *   sentido para el administrador: cada pantalla corta antes al empleado sin
 *   sucursal.
 *
 * `opciones` trae la lista para el selector solo cuando hay más de una para
 * elegir. `null` si no hay ninguna sucursal cargada.
 */
export async function sucursalDePantalla(
  usuario: UsuarioActivo,
  parametro: string | undefined,
): Promise<{ sucursal: SucursalBasica; opciones: SucursalBasica[] } | null> {
  if (usuario.sucursalId !== null) {
    const propia = await prisma.sucursal.findUnique({
      where: { id: usuario.sucursalId },
      select: { id: true, nombre: true },
    });
    if (propia) return { sucursal: propia, opciones: [] };
  }

  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: "asc" },
  });
  if (sucursales.length === 0) return null;

  const pedida = /^\d{1,9}$/.test(parametro ?? "") ? Number(parametro) : null;
  const sucursal = sucursales.find((s) => s.id === pedida) ?? sucursales[0]!;
  return { sucursal, opciones: sucursales.length > 1 ? sucursales : [] };
}
