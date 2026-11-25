import { Prisma, type MedioPagoGasto } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { aDecimal } from "@/lib/calculos";
import { DIAS_ATRAS_COMPRA } from "@/lib/config";
import { diaDelNegocio, esDiaValido, mediodiaDelDia, sumarDias } from "@/lib/fecha";
import { prisma } from "@/lib/prisma";

import {
  ErrorGasto,
  MAXIMO_COMPROBANTE,
  MAXIMO_DESCRIPCION,
  MINIMO_DESCRIPCION,
} from "./tipos";

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tope de `Decimal(10,2)`. */
const MONTO_MAXIMO = new Prisma.Decimal("99999999.99");

/** Datos del formulario, ya con el formato básico validado por la acción. */
export type DatosGasto = {
  claveIdempotencia: string;
  conceptoId: number;
  /** Monto con hasta 2 decimales, como string. */
  monto: string;
  medioPago: MedioPagoGasto;
  /** Solo la manda quien puede elegirla (administrador sin sucursal fija, o gastos que no son de caja). */
  sucursalId: number | null;
  /** `YYYY-MM-DD`. Nula = hoy. Los gastos de caja siempre son de hoy. */
  dia: string | null;
  descripcion: string;
  numeroComprobante: string | null;
  /** Gasto fijo del que se registra (Etapa 2). Solo administrador. */
  gastoFijoId: number | null;
};

export type GastoRegistrado = { gastoId: number; yaRegistrado: boolean };

/** Día del pago: ni futuro ni más viejo que `DIAS_ATRAS_COMPRA` (mismo límite que las compras). */
export function validarDiaGasto(dia: string, hoy: string = diaDelNegocio()): string | null {
  if (!esDiaValido(dia)) return "Elegí una fecha válida.";
  if (dia > hoy) return "La fecha del gasto no puede ser futura.";
  if (dia < sumarDias(hoy, -DIAS_ATRAS_COMPRA)) {
    return `La fecha no puede tener más de ${DIAS_ATRAS_COMPRA} días.`;
  }
  return null;
}

/**
 * Sucursal del gasto (sección 3.4 de la especificación):
 * - de caja: la del usuario si tiene una; si no, la elegida, o la única que haya;
 * - de otro medio: la elegida o ninguna (gasto general). Solo administrador.
 */
async function resolverSucursal(
  usuario: UsuarioActivo,
  medio: MedioPagoGasto,
  solicitada: number | null,
): Promise<number | null> {
  if (medio === "EFECTIVO_CAJA" && usuario.sucursalId !== null) {
    if (solicitada !== null && solicitada !== usuario.sucursalId) {
      throw new ErrorGasto(
        "SIN_PERMISO",
        "Solo podés registrar gastos de la caja de tu sucursal.",
        "sucursalId",
      );
    }
    return usuario.sucursalId;
  }
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorGasto(
      "SUCURSAL_REQUERIDA",
      "Tu usuario no tiene una sucursal asignada. Pedile al administrador que te asigne una.",
    );
  }

  const sucursales = await prisma.sucursal.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  if (solicitada !== null) {
    if (!sucursales.some((s) => s.id === solicitada)) {
      throw new ErrorGasto("SUCURSAL_REQUERIDA", "La sucursal elegida ya no existe.", "sucursalId");
    }
    return solicitada;
  }
  if (medio !== "EFECTIVO_CAJA") return null;
  if (sucursales.length === 1) return sucursales[0]!.id;
  throw new ErrorGasto(
    "SUCURSAL_REQUERIDA",
    sucursales.length === 0
      ? "No hay ninguna sucursal cargada."
      : "Elegí de qué caja salió el efectivo.",
    "sucursalId",
  );
}

async function gastoPorClave(clave: string): Promise<GastoRegistrado | null> {
  const gasto = await prisma.gasto.findUnique({
    where: { claveIdempotencia: clave },
    select: { id: true },
  });
  return gasto ? { gastoId: gasto.id, yaRegistrado: true } : null;
}

/**
 * Registra un gasto. El empleado solo registra gastos pagados con el efectivo
 * de la caja de su sucursal, con fecha de hoy; el administrador, cualquiera.
 * Un doble envío con la misma clave devuelve el gasto ya registrado.
 */
export async function registrarGasto(
  usuario: UsuarioActivo,
  datos: DatosGasto,
): Promise<GastoRegistrado> {
  if (!PATRON_UUID.test(datos.claveIdempotencia)) {
    throw new ErrorGasto("SIN_PERMISO", "El formulario no es válido. Recargá la página.");
  }
  const esAdmin = usuario.rol === "ADMINISTRADOR";
  if (!esAdmin && datos.medioPago !== "EFECTIVO_CAJA") {
    throw new ErrorGasto(
      "MEDIO_NO_PERMITIDO",
      "Solo podés registrar gastos pagados con el efectivo de la caja.",
      "medioPago",
    );
  }

  const monto = aDecimal(datos.monto);
  if (!monto.gt(0) || monto.gt(MONTO_MAXIMO) || monto.decimalPlaces() > 2) {
    throw new ErrorGasto("MONTO_INVALIDO", "Escribí un monto mayor que cero.", "monto");
  }
  const descripcion = datos.descripcion.trim();
  if (descripcion.length < MINIMO_DESCRIPCION || descripcion.length > MAXIMO_DESCRIPCION) {
    throw new ErrorGasto(
      "DESCRIPCION_REQUERIDA",
      `Describí el gasto (entre ${MINIMO_DESCRIPCION} y ${MAXIMO_DESCRIPCION} caracteres).`,
      "descripcion",
    );
  }
  const comprobante = datos.numeroComprobante?.trim() || null;
  if (comprobante && comprobante.length > MAXIMO_COMPROBANTE) {
    throw new ErrorGasto("DESCRIPCION_REQUERIDA", `Máximo ${MAXIMO_COMPROBANTE} caracteres.`, "numeroComprobante");
  }

  // El efectivo de caja sale ahora y se descuenta en el próximo cierre: el
  // gasto es de hoy. Uno olvidado de un período cerrado va fuera de caja.
  const hoy = diaDelNegocio();
  let dia = datos.dia ?? hoy;
  if (datos.medioPago === "EFECTIVO_CAJA") {
    if (dia !== hoy) {
      throw new ErrorGasto(
        "FECHA_INVALIDA",
        "Un gasto de caja siempre es de hoy. Si es de un período ya cerrado, registralo como efectivo fuera de caja.",
        "fecha",
      );
    }
    dia = hoy;
  } else {
    const error = validarDiaGasto(dia, hoy);
    if (error) throw new ErrorGasto("FECHA_INVALIDA", error, "fecha");
  }

  const existente = await gastoPorClave(datos.claveIdempotencia);
  if (existente) return existente;

  const sucursalId = await resolverSucursal(usuario, datos.medioPago, datos.sucursalId);

  const concepto = await prisma.conceptoGasto.findUnique({
    where: { id: datos.conceptoId },
    select: { activo: true },
  });
  if (!concepto?.activo) {
    throw new ErrorGasto("CONCEPTO_INACTIVO", "Elegí un concepto activo.", "conceptoId");
  }

  // Un gasto ligado a un fijo lo marca como registrado en el mes: tiene que
  // ser de su mismo concepto, o el resumen daría por pagado algo que no lo está.
  if (datos.gastoFijoId !== null) {
    if (!esAdmin) {
      throw new ErrorGasto("SIN_PERMISO", "Solo el administrador registra gastos fijos.");
    }
    const fijo = await prisma.gastoFijo.findUnique({
      where: { id: datos.gastoFijoId },
      select: { activo: true, conceptoId: true },
    });
    if (!fijo?.activo) {
      throw new ErrorGasto("GASTO_FIJO_INVALIDO", "El gasto fijo no existe o está desactivado.");
    }
    if (fijo.conceptoId !== datos.conceptoId) {
      throw new ErrorGasto(
        "GASTO_FIJO_INVALIDO",
        "El concepto tiene que ser el del gasto fijo.",
        "conceptoId",
      );
    }
  }

  try {
    const gasto = await prisma.gasto.create({
      data: {
        claveIdempotencia: datos.claveIdempotencia,
        fecha: mediodiaDelDia(dia),
        conceptoId: datos.conceptoId,
        monto,
        medioPago: datos.medioPago,
        descripcion,
        numeroComprobante: comprobante,
        usuarioId: usuario.id,
        sucursalId,
        gastoFijoId: datos.gastoFijoId,
      },
      select: { id: true },
    });
    return { gastoId: gasto.id, yaRegistrado: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      JSON.stringify(error.meta?.target ?? "").includes("claveIdempotencia")
    ) {
      const original = await gastoPorClave(datos.claveIdempotencia);
      if (original) return original;
    }
    throw error;
  }
}

/**
 * Corrección del administrador: concepto, descripción y comprobante. No mueven
 * dinero ni tocan ningún cierre; el resto se corrige anulando (sección 3.7).
 */
export async function corregirGasto(
  usuario: UsuarioActivo,
  gastoId: number,
  datos: { conceptoId: number; descripcion: string; numeroComprobante: string | null },
): Promise<void> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorGasto("SIN_PERMISO", "Solo el administrador corrige gastos.");
  }
  const descripcion = datos.descripcion.trim();
  if (descripcion.length < MINIMO_DESCRIPCION || descripcion.length > MAXIMO_DESCRIPCION) {
    throw new ErrorGasto(
      "DESCRIPCION_REQUERIDA",
      `Describí el gasto (entre ${MINIMO_DESCRIPCION} y ${MAXIMO_DESCRIPCION} caracteres).`,
      "descripcion",
    );
  }
  const comprobante = datos.numeroComprobante?.trim() || null;
  if (comprobante && comprobante.length > MAXIMO_COMPROBANTE) {
    throw new ErrorGasto("DESCRIPCION_REQUERIDA", `Máximo ${MAXIMO_COMPROBANTE} caracteres.`, "numeroComprobante");
  }

  const gasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    select: { conceptoId: true },
  });
  if (!gasto) throw new ErrorGasto("GASTO_NO_ENCONTRADO", "El gasto no existe.");

  // Se puede conservar un concepto que se desactivó después; cambiar a otro exige uno activo.
  if (datos.conceptoId !== gasto.conceptoId) {
    const concepto = await prisma.conceptoGasto.findUnique({
      where: { id: datos.conceptoId },
      select: { activo: true },
    });
    if (!concepto?.activo) {
      throw new ErrorGasto("CONCEPTO_INACTIVO", "Elegí un concepto activo.", "conceptoId");
    }
  }

  await prisma.gasto.update({
    where: { id: gastoId },
    data: { conceptoId: datos.conceptoId, descripcion, numeroComprobante: comprobante },
  });
}
