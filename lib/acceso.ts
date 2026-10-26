import type { Rol } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UsuarioActivo = {
  id: number;
  nombre: string;
  rol: Rol;
  sucursalId: number | null;
};

/**
 * Usuario de la sesión, confirmado contra la base: existe y está activo.
 *
 * Es la guardia de los Route Handlers de /api (que el middleware no cubre) y
 * de las pantallas de caja. Igual que `exigirAdministrador`, no se confía solo
 * en el JWT: el rol y la sucursal que se devuelven son los vigentes en la base.
 *
 * Devuelve `null` en vez de lanzar para que cada llamador responda a su modo
 * (401 en la API, redirect en una página).
 */
export async function requerirUsuarioActivo(): Promise<UsuarioActivo | null> {
  const sesion = await auth();
  const id = Number(sesion?.user?.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, nombre: true, rol: true, sucursalId: true, activo: true },
  });

  if (!usuario?.activo) return null;

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}

/**
 * Guardia de las server actions de administración.
 *
 * El middleware protege las páginas, pero una server action se puede invocar
 * desde cualquier ruta en la que el usuario tenga sesión (por ejemplo, un
 * empleado desde /caja). Por eso cada acción que escribe datos maestros vuelve
 * a validar el rol acá, del lado del servidor.
 *
 * El rol se confirma contra la base y no solo contra el JWT: un administrador
 * desactivado o degradado no debe poder seguir escribiendo con un token viejo.
 *
 * No vive en `permissions.ts` porque ese módulo corre en el Edge Runtime del
 * middleware y no puede importar Auth.js con Prisma.
 */
export async function exigirAdministrador() {
  const sesion = await auth();

  const vigente = sesion?.user
    ? await prisma.usuario.findUnique({
        where: { id: Number(sesion.user.id) },
        select: { activo: true, rol: true },
      })
    : null;

  if (!sesion?.user || !vigente?.activo || vigente.rol !== "ADMINISTRADOR") {
    throw new Error("Acción reservada al administrador.");
  }

  return sesion.user;
}
