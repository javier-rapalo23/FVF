"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuarioActivo, type UsuarioActivo } from "@/lib/acceso";
import { registrarConteo, registrarConteoLote, registrarMerma } from "@/lib/inventario/ajustar";
import {
  ErrorInventario,
  type ResultadoAjuste,
  type ResultadoConteoLote,
} from "@/lib/inventario/tipos";

/*
 * Server actions de inventario. Se pueden invocar desde cualquier pantalla con
 * sesión: cada una vuelve a confirmar contra la base que el usuario existe,
 * está activo y es administrador.
 */

async function administrador(): Promise<UsuarioActivo> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario || usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorInventario("SIN_PERMISO", "Acción reservada al administrador.");
  }
  return usuario;
}

function revalidarAfectadas() {
  revalidatePath("/inventario", "layout");
  revalidatePath("/productos");
  revalidatePath("/caja");
}

export async function registrarConteoAccion(payload: unknown): Promise<ResultadoAjuste> {
  try {
    const ajuste = await registrarConteo(await administrador(), payload);
    revalidarAfectadas();
    return { ok: true, ...ajuste };
  } catch (error) {
    if (error instanceof ErrorInventario) return error.serializar();
    throw error;
  }
}

export async function registrarMermaAccion(payload: unknown): Promise<ResultadoAjuste> {
  try {
    const ajuste = await registrarMerma(await administrador(), payload);
    revalidarAfectadas();
    return { ok: true, ...ajuste };
  } catch (error) {
    if (error instanceof ErrorInventario) return error.serializar();
    throw error;
  }
}

export async function registrarConteoLoteAccion(payload: unknown): Promise<ResultadoConteoLote> {
  try {
    const resultado = await registrarConteoLote(await administrador(), payload);
    revalidarAfectadas();
    return resultado;
  } catch (error) {
    if (error instanceof ErrorInventario) return error.serializar();
    throw error;
  }
}
