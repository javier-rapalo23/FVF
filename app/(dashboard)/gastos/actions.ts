"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requerirUsuarioActivo, type UsuarioActivo } from "@/lib/acceso";
import { leerFormulario, type EstadoFormulario } from "@/lib/formulario";
import { anularGasto } from "@/lib/gastos/anular";
import { guardarConcepto } from "@/lib/gastos/conceptos";
import { guardarGastoFijo } from "@/lib/gastos/fijos";
import { corregirGasto, registrarGasto } from "@/lib/gastos/registrar";
import {
  CATEGORIAS_GASTO,
  DIA_MAXIMO_GASTO_FIJO,
  ErrorGasto,
  MAXIMO_COMPROBANTE,
  MAXIMO_DESCRIPCION,
  MAXIMO_NOMBRE_CONCEPTO,
  MEDIOS_GASTO,
  type ResultadoAnulacionGasto,
} from "@/lib/gastos/tipos";

/*
 * Server actions de gastos. Como cualquier server action, se pueden invocar
 * desde cualquier pantalla con sesión: cada una confirma contra la base que el
 * usuario existe y está activo, y la lógica de `lib/gastos` valida el rol.
 */

const SESION_VENCIDA = "Tu sesión venció. Volvé a iniciar sesión.";

async function administrador(): Promise<UsuarioActivo> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario || usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorGasto("SIN_PERMISO", "Acción reservada al administrador.");
  }
  return usuario;
}

/** Un error de negocio va a su campo si tiene uno; si no, arriba del formulario. */
function conError(
  f: ReturnType<typeof leerFormulario>,
  error: unknown,
): EstadoFormulario {
  if (!(error instanceof ErrorGasto)) throw error;
  if (error.campo) {
    f.fallar(error.campo, error.message);
    return f.estado();
  }
  return f.estado(error.message);
}

function revalidarGastos(gastoId?: number) {
  revalidatePath("/gastos", "layout");
  if (gastoId) revalidatePath(`/gastos/${gastoId}`);
  revalidatePath("/cierres", "layout");
}

export async function registrarGastoAccion(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) return { error: SESION_VENCIDA, errores: {} };

  const f = leerFormulario(datos);
  const claveIdempotencia = f.texto("claveIdempotencia", { max: 36 });
  const conceptoId = f.id("conceptoId", "Elegí un concepto.");
  const monto = f.monto("monto");
  if (monto <= 0) f.fallar("monto", "Escribí un monto mayor que cero.");
  const medioPago = f.opcion("medioPago", MEDIOS_GASTO);
  const sucursalId = f.idOpcional("sucursalId");
  const dia = f.textoOpcional("fecha", { max: 10 });
  const descripcion = f.texto("descripcion", { max: MAXIMO_DESCRIPCION });
  const numeroComprobante = f.textoOpcional("numeroComprobante", { max: MAXIMO_COMPROBANTE });
  const gastoFijoId = f.idOpcional("gastoFijoId");
  if (!f.valido) return f.estado();

  let gastoId: number;
  try {
    const resultado = await registrarGasto(usuario, {
      claveIdempotencia,
      conceptoId,
      monto: monto.toFixed(2),
      medioPago,
      sucursalId,
      dia,
      descripcion,
      numeroComprobante,
      gastoFijoId,
    });
    gastoId = resultado.gastoId;
  } catch (error) {
    return conError(f, error);
  }

  revalidarGastos(gastoId);
  redirect(`/gastos?registrado=${gastoId}`);
}

export async function corregirGastoAccion(
  gastoId: number,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const f = leerFormulario(datos);
  try {
    const usuario = await administrador();
    const conceptoId = f.id("conceptoId", "Elegí un concepto.");
    const descripcion = f.texto("descripcion", { max: MAXIMO_DESCRIPCION });
    const numeroComprobante = f.textoOpcional("numeroComprobante", { max: MAXIMO_COMPROBANTE });
    if (!f.valido) return f.estado();
    await corregirGasto(usuario, gastoId, { conceptoId, descripcion, numeroComprobante });
  } catch (error) {
    return conError(f, error);
  }

  revalidarGastos(gastoId);
  redirect(`/gastos/${gastoId}?guardado=${encodeURIComponent(`El gasto N° ${gastoId}`)}`);
}

export async function anularGastoAccion(
  gastoId: number,
  motivo: string,
): Promise<ResultadoAnulacionGasto> {
  try {
    const usuario = await administrador();
    if (!Number.isInteger(gastoId) || gastoId <= 0) {
      throw new ErrorGasto("GASTO_NO_ENCONTRADO", "El gasto no existe.");
    }
    const efecto = await anularGasto(usuario, gastoId, motivo);
    revalidarGastos(gastoId);
    return { ok: true, efecto };
  } catch (error) {
    if (error instanceof ErrorGasto) {
      return { ok: false, codigo: error.codigo, mensaje: error.message };
    }
    throw error;
  }
}

function leerConcepto(datos: FormData, conActivo: boolean) {
  const f = leerFormulario(datos);
  const nombre = f.texto("nombre", { max: MAXIMO_NOMBRE_CONCEPTO });
  const categoria = f.opcion("categoria", CATEGORIAS_GASTO);
  const activo = conActivo ? f.booleano("activo") : true;
  return { f, datos: { nombre, categoria, activo } };
}

export async function crearConceptoAccion(
  _previo: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const { f, datos } = leerConcepto(formulario, false);
  try {
    await administrador();
    if (!f.valido) return f.estado();
    await guardarConcepto(null, datos);
  } catch (error) {
    return conError(f, error);
  }
  revalidarGastos();
  return { error: null, errores: {}, exito: `Concepto «${datos.nombre}» creado.` };
}

export async function editarConceptoAccion(
  id: number,
  _previo: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const { f, datos } = leerConcepto(formulario, true);
  try {
    await administrador();
    if (!f.valido) return f.estado();
    await guardarConcepto(id, datos);
  } catch (error) {
    return conError(f, error);
  }
  revalidarGastos();
  return { error: null, errores: {}, exito: "Guardado." };
}

/** Alta (`id` null) o edición de un gasto fijo (sección 6.3). */
export async function guardarGastoFijoAccion(
  id: number | null,
  _previo: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const f = leerFormulario(formulario);
  const conceptoId = f.id("conceptoId", "Elegí un concepto.");
  const descripcion = f.texto("descripcion", { max: MAXIMO_DESCRIPCION });
  const montoEstimado = f.monto("montoEstimado");
  if (montoEstimado <= 0) f.fallar("montoEstimado", "Escribí un monto mayor que cero.");
  const diaDelMes = f.entero("diaDelMes");
  if (diaDelMes > DIA_MAXIMO_GASTO_FIJO) {
    f.fallar("diaDelMes", `Elegí un día entre 1 y ${DIA_MAXIMO_GASTO_FIJO}.`);
  }
  const medioPago = f.opcion("medioPago", MEDIOS_GASTO);
  const sucursalId = f.idOpcional("sucursalId");
  const activo = id === null ? true : f.booleano("activo");
  try {
    await administrador();
    if (!f.valido) return f.estado();
    await guardarGastoFijo(id, {
      conceptoId,
      descripcion,
      montoEstimado: montoEstimado.toFixed(2),
      diaDelMes,
      medioPago,
      sucursalId,
      activo,
    });
  } catch (error) {
    return conError(f, error);
  }

  revalidarGastos();
  redirect(`/gastos/fijos?guardado=${encodeURIComponent(descripcion)}`);
}
