import { Prisma, type CategoriaGasto, type PrismaClient } from "@prisma/client";

import { inicioYFinDelDia } from "@/lib/fecha";

import { CATEGORIAS_GASTO } from "./tipos";

/*
 * Totales de gastos de un período. Lo usa el resumen mensual de gastos y lo
 * va a usar el módulo de Reportes para el estado de resultados: es la única
 * cuenta de "cuánto se gastó", así las dos pantallas siempre coinciden con el
 * listado. Los anulados nunca suman.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const CERO = new Prisma.Decimal(0);

export type FiltroResumen = {
  /** Primer día del período, `YYYY-MM-DD` (incluido). */
  desde: string;
  /** Último día del período, `YYYY-MM-DD` (incluido). */
  hasta: string;
  /** `undefined` = todas las sucursales; `null` = solo los gastos generales. */
  sucursalId?: number | null;
};

export type ResumenGastos = {
  total: Prisma.Decimal;
  cantidad: number;
  /** Las tres categorías, en su orden, aunque estén en cero. */
  porCategoria: { categoria: CategoriaGasto; total: Prisma.Decimal; cantidad: number }[];
  /** Solo los conceptos con gastos, de mayor a menor. */
  porConcepto: {
    conceptoId: number;
    nombre: string;
    categoria: CategoriaGasto;
    total: Prisma.Decimal;
    cantidad: number;
  }[];
  /** Solo las sucursales con gastos, de mayor a menor. `sucursalId` nulo = "General". */
  porSucursal: { sucursalId: number | null; nombre: string; total: Prisma.Decimal; cantidad: number }[];
};

/** Condición de los gastos que cuentan en el período (sin los anulados). */
export function filtroDelPeriodo({ desde, hasta, sucursalId }: FiltroResumen): Prisma.GastoWhereInput {
  return {
    anulado: false,
    fecha: { gte: inicioYFinDelDia(desde).inicio, lt: inicioYFinDelDia(hasta).fin },
    ...(sucursalId === undefined ? {} : { sucursalId }),
  };
}

export async function resumenDeGastos(db: Db, filtro: FiltroResumen): Promise<ResumenGastos> {
  const grupos = await db.gasto.groupBy({
    by: ["conceptoId", "sucursalId"],
    where: filtroDelPeriodo(filtro),
    _sum: { monto: true },
    _count: { _all: true },
  });

  const conceptoIds = [...new Set(grupos.map((g) => g.conceptoId))];
  const sucursalIds = [...new Set(grupos.flatMap((g) => (g.sucursalId === null ? [] : [g.sucursalId])))];
  const [conceptos, sucursales] = await Promise.all([
    conceptoIds.length
      ? db.conceptoGasto.findMany({
          where: { id: { in: conceptoIds } },
          select: { id: true, nombre: true, categoria: true },
        })
      : [],
    sucursalIds.length
      ? db.sucursal.findMany({ where: { id: { in: sucursalIds } }, select: { id: true, nombre: true } })
      : [],
  ]);
  const conceptoPorId = new Map(conceptos.map((c) => [c.id, c]));
  const nombreSucursal = new Map(sucursales.map((s) => [s.id, s.nombre]));

  type Acumulado = { total: Prisma.Decimal; cantidad: number };
  const sumar = <K>(mapa: Map<K, Acumulado>, clave: K, monto: Prisma.Decimal, cantidad: number) => {
    const previo = mapa.get(clave) ?? { total: CERO, cantidad: 0 };
    mapa.set(clave, { total: previo.total.plus(monto), cantidad: previo.cantidad + cantidad });
  };

  const porConcepto = new Map<number, Acumulado>();
  const porSucursal = new Map<number | null, Acumulado>();
  const porCategoria = new Map<CategoriaGasto, Acumulado>();
  let total = CERO;
  let cantidad = 0;

  for (const grupo of grupos) {
    const concepto = conceptoPorId.get(grupo.conceptoId);
    if (!concepto) continue;
    const monto = grupo._sum.monto ?? CERO;
    const n = grupo._count._all;
    sumar(porConcepto, grupo.conceptoId, monto, n);
    sumar(porSucursal, grupo.sucursalId, monto, n);
    sumar(porCategoria, concepto.categoria, monto, n);
    total = total.plus(monto);
    cantidad += n;
  }

  const deMayorAMenor = (a: { total: Prisma.Decimal }, b: { total: Prisma.Decimal }) =>
    b.total.comparedTo(a.total);

  return {
    total,
    cantidad,
    porCategoria: CATEGORIAS_GASTO.map((categoria) => ({
      categoria,
      ...(porCategoria.get(categoria) ?? { total: CERO, cantidad: 0 }),
    })),
    porConcepto: [...porConcepto.entries()]
      .map(([conceptoId, valor]) => {
        const concepto = conceptoPorId.get(conceptoId)!;
        return { conceptoId, nombre: concepto.nombre, categoria: concepto.categoria, ...valor };
      })
      .sort((a, b) => deMayorAMenor(a, b) || a.nombre.localeCompare(b.nombre, "es")),
    porSucursal: [...porSucursal.entries()]
      .map(([sucursalId, valor]) => ({
        sucursalId,
        nombre: sucursalId === null ? "General" : (nombreSucursal.get(sucursalId) ?? `Sucursal ${sucursalId}`),
        ...valor,
      }))
      .sort(deMayorAMenor),
  };
}

/** Variación de un total contra el período anterior. `porcentaje` es nulo si antes no hubo gastos. */
export function variacion(
  actual: Prisma.Decimal,
  anterior: Prisma.Decimal,
): { diferencia: Prisma.Decimal; porcentaje: Prisma.Decimal | null } {
  const diferencia = actual.minus(anterior);
  return {
    diferencia,
    porcentaje: anterior.isZero() ? null : diferencia.div(anterior).mul(100).toDecimalPlaces(1),
  };
}
