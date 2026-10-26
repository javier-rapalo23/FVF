import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
