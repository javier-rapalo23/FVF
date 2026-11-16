"use server";

import { revalidatePath } from "next/cache";

import { requerirUsuarioActivo, type UsuarioActivo } from "@/lib/acceso";
import { anularCompra } from "@/lib/compras/anular";
import { registrarCompra } from "@/lib/compras/registrar";
import {
  ErrorCompra,
  type ResultadoAnulacionCompra,
  type ResultadoRegistroCompra,
} from "@/lib/compras/tipos";
import { prisma } from "@/lib/prisma";

/*
 * Server actions de compras. Como cualquier server action, se pueden invocar
 * desde cualquier pantalla con sesión: cada una vuelve a confirmar contra la
 * base que el usuario existe, está activo y es administrador.
 */

async function administrador(): Promise<UsuarioActivo> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario || usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCompra("SIN_PERMISO", "Acción reservada al administrador.");
  }
  return usuario;
}

function revalidarAfectadas(compraId?: number) {
  revalidatePath("/compras");
  if (compraId) revalidatePath(`/compras/${compraId}`);
  revalidatePath("/productos", "layout");
  revalidatePath("/proveedores", "layout");
}

export async function registrarCompraAccion(payload: unknown): Promise<ResultadoRegistroCompra> {
  try {
    const usuario = await administrador();
    const resultado = await registrarCompra(usuario, payload);
    if (resultado.ok) revalidarAfectadas(resultado.compraId);
    return resultado;
  } catch (error) {
    if (error instanceof ErrorCompra) return error.serializar();
    throw error;
  }
}

export async function anularCompraAccion(
  compraId: number,
  motivo: string,
): Promise<ResultadoAnulacionCompra> {
  try {
    const usuario = await administrador();
    if (!Number.isInteger(compraId) || compraId <= 0) {
      throw new ErrorCompra("COMPRA_NO_ENCONTRADA", "La compra no existe.");
    }
    const resultado = await anularCompra(usuario, compraId, motivo);
    revalidarAfectadas(compraId);
    return resultado;
  } catch (error) {
    if (error instanceof ErrorCompra) return error.serializar();
    throw error;
  }
}

/**
 * Compras vigentes del mismo proveedor con el mismo número de factura. Solo
 * para avisar: una factura repetida puede ser un error de tipeo o una entrega
 * dividida, así que no se bloquea.
 */
export async function buscarFacturaRepetida(
  proveedorId: number,
  numeroFactura: string,
): Promise<{ id: number; fecha: string }[]> {
  await administrador();
  const numero = numeroFactura.trim();
  if (!Number.isInteger(proveedorId) || proveedorId <= 0 || !numero) return [];

  const compras = await prisma.compra.findMany({
    where: {
      proveedorId,
      anulada: false,
      numeroFactura: { equals: numero, mode: "insensitive" },
    },
    select: { id: true, fecha: true },
    orderBy: { fecha: "desc" },
    take: 5,
  });
  return compras.map((c) => ({ id: c.id, fecha: c.fecha.toISOString() }));
}
