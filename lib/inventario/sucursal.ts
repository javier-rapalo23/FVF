import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";
import type { SucursalBasica } from "@/lib/sucursal";

import { ErrorInventario } from "./tipos";

type Sucursal = SucursalBasica;

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
