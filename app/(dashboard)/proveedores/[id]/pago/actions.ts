"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requerirUsuarioActivo } from "@/lib/acceso";
import { anularPagoProveedor } from "@/lib/cuentas/anular";
import { registrarPagoProveedor } from "@/lib/cuentas/pagos";
import {
  ErrorCuenta,
  MAXIMO_NOTA_CUENTA,
  MEDIOS_PAGO_PROVEEDOR,
  type ResultadoAnulacionCuenta,
} from "@/lib/cuentas/tipos";
import { formatoMoneda } from "@/lib/formato";
import { leerFormulario, type EstadoFormulario } from "@/lib/formulario";

/** Pago a un proveedor. Solo administrador: lo valida `lib/cuentas/pagos`. Se usa con `.bind`. */
export async function registrarPagoAccion(
  proveedorId: number,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) return { error: "Tu sesión venció. Volvé a iniciar sesión.", errores: {} };

  const f = leerFormulario(datos);
  const claveIdempotencia = f.texto("claveIdempotencia", { max: 36 });
  const monto = f.monto("monto");
  if (monto <= 0) f.fallar("monto", "Escribí un monto mayor que cero.");
  const medioPago = f.opcion("medioPago", MEDIOS_PAGO_PROVEEDOR);
  const sucursalId = f.idOpcional("sucursalId");
  const nota = f.textoOpcional("nota", { max: MAXIMO_NOTA_CUENTA });
  if (!f.valido) return f.estado();

  try {
    await registrarPagoProveedor(usuario, {
      claveIdempotencia,
      proveedorId,
      monto: monto.toFixed(2),
      medioPago,
      sucursalId,
      nota,
    });
  } catch (error) {
    if (!(error instanceof ErrorCuenta)) throw error;
    if (error.campo) {
      f.fallar(error.campo, error.message);
      return f.estado();
    }
    return f.estado(error.message);
  }

  revalidatePath("/proveedores", "layout");
  revalidatePath("/cierres", "layout");
  redirect(
    `/proveedores/${proveedorId}?guardado=${encodeURIComponent(`El pago de ${formatoMoneda(monto)}`)}`,
  );
}

/** Anulación de un pago a proveedor. Solo administrador. Se usa con `.bind`. */
export async function anularPagoAccion(
  proveedorId: number,
  pagoId: number,
  motivo: string,
): Promise<ResultadoAnulacionCuenta> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) {
    return { ok: false, codigo: "SIN_PERMISO", mensaje: "Tu sesión venció. Volvé a iniciar sesión." };
  }
  try {
    if (![proveedorId, pagoId].every((n) => Number.isInteger(n) && n > 0)) {
      throw new ErrorCuenta("PAGO_NO_ENCONTRADO", "El pago no existe.");
    }
    const efecto = await anularPagoProveedor(usuario, proveedorId, pagoId, motivo);
    revalidatePath("/proveedores", "layout");
    revalidatePath("/cierres", "layout");
    return { ok: true, efecto };
  } catch (error) {
    if (error instanceof ErrorCuenta) {
      return { ok: false, codigo: error.codigo, mensaje: error.message };
    }
    throw error;
  }
}
