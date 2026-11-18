import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import { ErrorInventario } from "./tipos";

type Sucursal = { id: number; nombre: string };

/**
 * Sucursal que muestra la pantalla de inventario.
 *
 * - Administrador con sucursal asignada: la suya; el parámetro se ignora.
 * - Sin sucursal: la del parámetro `?sucursal=`, o la primera.
 *
 * `opciones` trae la lista para el selector solo cuando hay más de una para
 * elegir. `null` si no hay ninguna sucursal cargada.
 */
export async function sucursalDePantalla(
  usuario: UsuarioActivo,
  parametro: string | undefined,
): Promise<{ sucursal: Sucursal; opciones: Sucursal[] } | null> {
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

/**
 * Sucursal de un ajuste. Mismo criterio que la pantalla, pero sin elegir por
 * defecto: si el administrador no tiene sucursal y hay varias, la pantalla
 * tiene que haber mandado cuál.
 */
export async function resolverSucursalAjuste(
  usuario: UsuarioActivo,
  solicitada: number | null,
): Promise<Sucursal> {
  if (usuario.sucursalId !== null) {
    const propia = await prisma.sucursal.findUnique({
      where: { id: usuario.sucursalId },
      select: { id: true, nombre: true },
    });
    if (propia) return propia;
  }

  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: "asc" },
  });

  const elegida = sucursales.find((s) => s.id === solicitada);
  if (elegida) return elegida;
  if (sucursales.length === 1 && solicitada === null) return sucursales[0]!;

  throw new ErrorInventario(
    "SUCURSAL_REQUERIDA",
    sucursales.length === 0
      ? "No hay ninguna sucursal cargada."
      : "No se pudo determinar la sucursal. Recargá la página.",
  );
}
