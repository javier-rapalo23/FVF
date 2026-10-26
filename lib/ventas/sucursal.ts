import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import { ErrorVenta } from "./tipos";

/**
 * Sucursal sobre la que opera la caja.
 *
 * - Usuario con sucursal asignada (siempre el caso del empleado): la suya. Lo
 *   que pida el cliente se ignora.
 * - Administrador sin sucursal: la que eligió en pantalla; si hay una sola,
 *   esa, sin preguntar.
 *
 * Si no se puede resolver, `SUCURSAL_REQUERIDA` lleva la lista de sucursales
 * para que la pantalla ofrezca elegir.
 */
export async function resolverSucursal(
  usuario: UsuarioActivo,
  solicitada: number | null,
): Promise<{ id: number; nombre: string }> {
  if (usuario.sucursalId !== null) {
    const propia = await prisma.sucursal.findUnique({
      where: { id: usuario.sucursalId },
      select: { id: true, nombre: true },
    });
    if (propia) return propia;
  }

  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorVenta(
      "SUCURSAL_REQUERIDA",
      400,
      "Tu usuario no tiene una sucursal asignada. Pedile al administrador que te asigne una.",
    );
  }

  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: "asc" },
  });

  const elegida = sucursales.find((s) => s.id === solicitada);
  if (elegida) return elegida;
  if (sucursales.length === 1 && solicitada === null) return sucursales[0]!;

  throw new ErrorVenta(
    "SUCURSAL_REQUERIDA",
    400,
    sucursales.length === 0
      ? "No hay ninguna sucursal cargada."
      : "Elegí la sucursal en la que estás vendiendo.",
    { sucursales },
  );
}
