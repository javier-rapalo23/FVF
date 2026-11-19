"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuarioActivo, type UsuarioActivo } from "@/lib/acceso";
import { registrarCierre, revisarCierre, vistaPreviaCierre } from "@/lib/cierres/registrar";
import {
  ErrorCierre,
  type ResultadoCierre,
  type ResultadoRevision,
  type ResultadoVistaPrevia,
} from "@/lib/cierres/tipos";

/*
 * Server actions del cierre de caja. Cerrar pueden ambos roles (cada uno en
 * su sucursal); revisar, solo el administrador. Cada acción vuelve a
 * confirmar el usuario contra la base.
 */

async function usuarioActivo(): Promise<UsuarioActivo> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) throw new ErrorCierre("SIN_PERMISO", "Tu sesión venció. Volvé a iniciar sesión.");
  return usuario;
}

export async function vistaPreviaCierreAccion(payload: unknown): Promise<ResultadoVistaPrevia> {
  try {
    return await vistaPreviaCierre(await usuarioActivo(), payload);
  } catch (error) {
    if (error instanceof ErrorCierre) return error.serializar();
    throw error;
  }
}

export async function registrarCierreAccion(payload: unknown): Promise<ResultadoCierre> {
  try {
    const resultado = await registrarCierre(await usuarioActivo(), payload);
    revalidatePath("/cierres", "layout");
    return resultado;
  } catch (error) {
    if (error instanceof ErrorCierre) return error.serializar();
    throw error;
  }
}

export async function revisarCierreAccion(
  cierreId: number,
  nota: string,
): Promise<ResultadoRevision> {
  try {
    if (!Number.isInteger(cierreId) || cierreId <= 0) {
      throw new ErrorCierre("CIERRE_NO_ENCONTRADO", "El cierre no existe.");
    }
    await revisarCierre(await usuarioActivo(), cierreId, nota);
    revalidatePath("/cierres", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorCierre) return error.serializar();
    throw error;
  }
}
