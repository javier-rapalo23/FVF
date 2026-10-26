"use server";

import type { Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirAdministrador } from "@/lib/acceso";
import {
  campoDuplicado,
  esRelacionInvalida,
  leerFormulario,
  type EstadoFormulario,
} from "@/lib/formulario";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMINISTRADOR", "EMPLEADO_CAJA"] as const satisfies readonly Rol[];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** bcrypt ignora todo lo que pase de 72 bytes: se corta antes para que no sorprenda. */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

/** Mismo costo que el seed. */
const COSTO_HASH = 10;

/** Alta (`id` null) o edición de un usuario. Se usa enlazada con `.bind`. */
export async function guardarUsuario(
  id: number | null,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const sesion = await exigirAdministrador();

  const f = leerFormulario(datos);
  const nombre = f.texto("nombre");
  const email = f.texto("email").toLowerCase();
  const rol = f.opcion("rol", ROLES);
  const sucursalId = f.idOpcional("sucursalId");
  const activo = id === null ? true : f.booleano("activo");

  // La contraseña se lee tal cual: espacios incluidos, sin normalizar.
  const crudo = datos.get("password");
  const password = typeof crudo === "string" ? crudo : "";

  if (email && !EMAIL.test(email)) f.fallar("email", "Email inválido.");

  if (id === null && !password) {
    f.fallar("password", "Campo obligatorio.");
  } else if (password && password.length < PASSWORD_MIN) {
    f.fallar("password", `Mínimo ${PASSWORD_MIN} caracteres.`);
  } else if (new TextEncoder().encode(password).length > PASSWORD_MAX) {
    f.fallar("password", "Contraseña demasiado larga.");
  }

  // La caja opera siempre contra el stock de una sucursal concreta.
  if (rol === "EMPLEADO_CAJA" && sucursalId === null) {
    f.fallar("sucursalId", "El empleado de caja necesita una sucursal.");
  }

  if (!f.valido) return f.estado();

  // Salvaguardas para no dejar el sistema sin nadie que lo administre.
  if (id !== null) {
    const pierdeAdmin = rol !== "ADMINISTRADOR" || !activo;

    if (String(id) === sesion.id && pierdeAdmin) {
      return f.estado(
        "No podés quitarte el rol de administrador ni desactivar tu propio usuario.",
      );
    }

    if (pierdeAdmin) {
      const otrosAdmins = await prisma.usuario.count({
        where: { rol: "ADMINISTRADOR", activo: true, NOT: { id } },
      });
      if (otrosAdmins === 0) {
        return f.estado("Tiene que quedar al menos un administrador activo.");
      }
    }
  }

  const mismoEmail = await prisma.usuario.findFirst({
    where: { email, ...(id === null ? {} : { NOT: { id } }) },
    select: { nombre: true },
  });
  if (mismoEmail) {
    f.fallar("email", `Ya lo usa ${mismoEmail.nombre}.`);
    return f.estado();
  }

  const usuario = {
    nombre,
    email,
    rol,
    sucursalId,
    activo,
    ...(password ? { passwordHash: await bcrypt.hash(password, COSTO_HASH) } : {}),
  };

  try {
    if (id === null) {
      await prisma.usuario.create({
        data: { ...usuario, passwordHash: usuario.passwordHash ?? "" },
      });
    } else {
      await prisma.usuario.update({ where: { id }, data: usuario });
    }
  } catch (error) {
    if (campoDuplicado(error, ["email"])) {
      f.fallar("email", "Otro usuario ya usa este email.");
      return f.estado();
    }
    if (esRelacionInvalida(error)) {
      return f.estado("La sucursal o el usuario ya no existen. Recargá la página.");
    }
    throw error;
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios?guardado=${encodeURIComponent(nombre)}`);
}
