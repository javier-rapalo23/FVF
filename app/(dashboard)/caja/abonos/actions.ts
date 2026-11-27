"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requerirUsuarioActivo } from "@/lib/acceso";
import { registrarAbono } from "@/lib/cuentas/abonos";
import { anularAbono } from "@/lib/cuentas/anular";
import {
  ErrorCuenta,
  MAXIMO_NOTA_CUENTA,
  MEDIOS_ABONO,
  type ResultadoAnulacionCuenta,
} from "@/lib/cuentas/tipos";
import { leerFormulario, type EstadoFormulario } from "@/lib/formulario";

/**
 * Abono de un cliente a su cuenta de fiado. Lo usan la caja (empleado) y la
 * ficha del cliente (administrador); `lib/cuentas/abonos` valida rol y sucursal.
 * Al guardar abre el comprobante listo para imprimir.
 */
export async function registrarAbonoAccion(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) return { error: "Tu sesión venció. Volvé a iniciar sesión.", errores: {} };

  const f = leerFormulario(datos);
  const claveIdempotencia = f.texto("claveIdempotencia", { max: 36 });
  const clienteId = f.id("clienteId", "Elegí el cliente.");
  const monto = f.monto("monto");
  if (monto <= 0) f.fallar("monto", "Escribí un monto mayor que cero.");
  const medioPago = f.opcion("medioPago", MEDIOS_ABONO);
  const sucursalId = f.idOpcional("sucursalId");
  const nota = f.textoOpcional("nota", { max: MAXIMO_NOTA_CUENTA });
  if (!f.valido) return f.estado();

  let abonoId: number;
  try {
    const resultado = await registrarAbono(usuario, {
      claveIdempotencia,
      clienteId,
      monto: monto.toFixed(2),
      medioPago,
      sucursalId,
      nota,
    });
    abonoId = resultado.abonoId;
  } catch (error) {
    if (!(error instanceof ErrorCuenta)) throw error;
    if (error.campo) {
      f.fallar(error.campo, error.message);
      return f.estado();
    }
    return f.estado(error.message);
  }

  revalidatePath("/clientes", "layout");
  revalidatePath("/cierres", "layout");
  redirect(`/caja/abonos/${abonoId}?imprimir=1`);
}

/** Anulación de un abono. Solo administrador: lo valida `lib/cuentas/anular`. Se usa con `.bind`. */
export async function anularAbonoAccion(
  abonoId: number,
  motivo: string,
): Promise<ResultadoAnulacionCuenta> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) {
    return { ok: false, codigo: "SIN_PERMISO", mensaje: "Tu sesión venció. Volvé a iniciar sesión." };
  }
  try {
    if (!Number.isInteger(abonoId) || abonoId <= 0) {
      throw new ErrorCuenta("ABONO_NO_ENCONTRADO", "El abono no existe.");
    }
    const efecto = await anularAbono(usuario, abonoId, motivo);
    revalidatePath("/clientes", "layout");
    revalidatePath("/caja/abonos", "layout");
    revalidatePath("/cierres", "layout");
    return { ok: true, efecto };
  } catch (error) {
    if (error instanceof ErrorCuenta) {
      return { ok: false, codigo: error.codigo, mensaje: error.message };
    }
    throw error;
  }
}
