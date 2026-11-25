import { Prisma, type CategoriaGasto, type MedioPagoGasto, type PrismaClient } from "@prisma/client";

import { aDecimal } from "@/lib/calculos";
import { diaDelNegocio, diasDelMes } from "@/lib/fecha";
import { prisma } from "@/lib/prisma";

import { filtroDelPeriodo } from "./resumen";
import {
  DIA_MAXIMO_GASTO_FIJO,
  ErrorGasto,
  MAXIMO_DESCRIPCION,
  MINIMO_DESCRIPCION,
  type EstadoGastoFijo,
} from "./tipos";

/*
 * Gastos fijos (sección 6.3): un recordatorio con plantilla de lo que se paga
 * todos los meses. Nada se registra solo: el administrador registra el gasto
 * desde el resumen, y ese gasto queda ligado al fijo con `gastoFijoId`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Tope de `Decimal(10,2)`. */
const MONTO_MAXIMO = new Prisma.Decimal("99999999.99");

export type DatosGastoFijo = {
  conceptoId: number;
  descripcion: string;
  /** Monto con hasta 2 decimales, como string. */
  montoEstimado: string;
  diaDelMes: number;
  medioPago: MedioPagoGasto;
  /** Nula = gasto general. Obligatoria si se paga con el efectivo de la caja. */
  sucursalId: number | null;
  activo: boolean;
};

/** Alta (`id` null) o edición de un gasto fijo. Devuelve su id. Solo administrador (lo valida la acción). */
export async function guardarGastoFijo(id: number | null, datos: DatosGastoFijo): Promise<number> {
  const descripcion = datos.descripcion.trim();
  if (descripcion.length < MINIMO_DESCRIPCION || descripcion.length > MAXIMO_DESCRIPCION) {
    throw new ErrorGasto(
      "DESCRIPCION_REQUERIDA",
      `Describí el gasto (entre ${MINIMO_DESCRIPCION} y ${MAXIMO_DESCRIPCION} caracteres).`,
      "descripcion",
    );
  }
  const monto = aDecimal(datos.montoEstimado);
  if (!monto.gt(0) || monto.gt(MONTO_MAXIMO) || monto.decimalPlaces() > 2) {
    throw new ErrorGasto("MONTO_INVALIDO", "Escribí un monto mayor que cero.", "montoEstimado");
  }
  if (!Number.isInteger(datos.diaDelMes) || datos.diaDelMes < 1 || datos.diaDelMes > DIA_MAXIMO_GASTO_FIJO) {
    throw new ErrorGasto(
      "DIA_DEL_MES_INVALIDO",
      `Elegí un día entre 1 y ${DIA_MAXIMO_GASTO_FIJO}, así existe en todos los meses.`,
      "diaDelMes",
    );
  }

  const actual =
    id === null
      ? null
      : await prisma.gastoFijo.findUnique({ where: { id }, select: { conceptoId: true } });
  if (id !== null && !actual) {
    throw new ErrorGasto("GASTO_FIJO_INVALIDO", "El gasto fijo no existe.");
  }

  // Igual que al corregir un gasto: se puede conservar un concepto que se
  // desactivó después, pero elegir otro exige uno activo.
  if (!actual || actual.conceptoId !== datos.conceptoId) {
    const concepto = await prisma.conceptoGasto.findUnique({
      where: { id: datos.conceptoId },
      select: { activo: true },
    });
    if (!concepto?.activo) {
      throw new ErrorGasto("CONCEPTO_INACTIVO", "Elegí un concepto activo.", "conceptoId");
    }
  }

  if (datos.sucursalId !== null) {
    const sucursal = await prisma.sucursal.findUnique({ where: { id: datos.sucursalId }, select: { id: true } });
    if (!sucursal) {
      throw new ErrorGasto("SUCURSAL_REQUERIDA", "La sucursal elegida ya no existe.", "sucursalId");
    }
  } else if (datos.medioPago === "EFECTIVO_CAJA") {
    throw new ErrorGasto(
      "SUCURSAL_REQUERIDA",
      "Elegí de qué caja sale el efectivo.",
      "sucursalId",
    );
  }

  const data = {
    conceptoId: datos.conceptoId,
    descripcion,
    montoEstimado: monto,
    diaDelMes: datos.diaDelMes,
    medioPago: datos.medioPago,
    sucursalId: datos.sucursalId,
    activo: id === null ? true : datos.activo,
  };
  const guardado =
    id === null
      ? await prisma.gastoFijo.create({ data, select: { id: true } })
      : await prisma.gastoFijo.update({ where: { id }, data, select: { id: true } });
  return guardado.id;
}

export type GastoFijoDelMes = {
  id: number;
  descripcion: string;
  concepto: { id: number; nombre: string; categoria: CategoriaGasto; activo: boolean };
  montoEstimado: Prisma.Decimal;
  diaDelMes: number;
  medioPago: MedioPagoGasto;
  sucursal: { id: number; nombre: string } | null;
  estado: EstadoGastoFijo;
  /** Gastos no anulados del mes registrados desde este fijo. */
  registrados: { id: number; monto: Prisma.Decimal }[];
};

/**
 * Estado de un gasto fijo en un mes:
 * - Registrado: hay un gasto no anulado del mes ligado a él;
 * - Pendiente: todavía no llegó su día (o el mes es futuro);
 * - Atrasado: ya pasó su día y no se registró.
 * En el día de pago sigue pendiente: todavía se puede pagar ese día.
 */
export function estadoDelFijo(
  mes: string,
  diaDelMes: number,
  registrado: boolean,
  hoy: string = diaDelNegocio(),
): EstadoGastoFijo {
  if (registrado) return "REGISTRADO";
  const mesActual = hoy.slice(0, 7);
  if (mes < mesActual) return "ATRASADO";
  if (mes > mesActual) return "PENDIENTE";
  return Number(hoy.slice(8, 10)) > diaDelMes ? "ATRASADO" : "PENDIENTE";
}

/**
 * Gastos fijos activos con su estado en el mes (`YYYY-MM`), ordenados por día
 * de pago. `sucursalId` filtra igual que en el resumen: `undefined` = todos,
 * `null` = solo los generales.
 */
export async function gastosFijosDelMes(
  db: Db,
  { mes, sucursalId, hoy = diaDelNegocio() }: { mes: string; sucursalId?: number | null; hoy?: string },
): Promise<GastoFijoDelMes[]> {
  const fijos = await db.gastoFijo.findMany({
    where: { activo: true, ...(sucursalId === undefined ? {} : { sucursalId }) },
    select: {
      id: true,
      descripcion: true,
      montoEstimado: true,
      diaDelMes: true,
      medioPago: true,
      concepto: { select: { id: true, nombre: true, categoria: true, activo: true } },
      sucursal: { select: { id: true, nombre: true } },
    },
    orderBy: [{ diaDelMes: "asc" }, { id: "asc" }],
  });
  if (fijos.length === 0) return [];

  const gastos = await db.gasto.findMany({
    where: { ...filtroDelPeriodo(diasDelMes(mes)), gastoFijoId: { in: fijos.map((f) => f.id) } },
    select: { id: true, monto: true, gastoFijoId: true },
    orderBy: { id: "asc" },
  });

  return fijos.map((fijo) => {
    const registrados = gastos
      .filter((g) => g.gastoFijoId === fijo.id)
      .map((g) => ({ id: g.id, monto: g.monto }));
    return {
      ...fijo,
      estado: estadoDelFijo(mes, fijo.diaDelMes, registrados.length > 0, hoy),
      registrados,
    };
  });
}
