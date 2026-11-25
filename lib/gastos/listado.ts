import type { CategoriaGasto, MedioPagoGasto, Prisma } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { diaDelNegocio, esDiaValido, inicioYFinDelDia, sumarDias } from "@/lib/fecha";

import { CATEGORIAS_GASTO, MEDIOS_GASTO } from "./tipos";

/*
 * Filtros del listado de gastos. Los comparten la pantalla `/gastos` y la
 * exportación a CSV, así el archivo trae exactamente las filas del filtro.
 */

/** Lo que ve el empleado: los gastos de caja de su sucursal de los últimos días. */
export const DIAS_EMPLEADO = 30;

/** Parámetros de la URL que definen el filtro (sin la página). */
export const PARAMETROS_FILTRO = [
  "desde",
  "hasta",
  "sucursal",
  "categoria",
  "concepto",
  "medio",
  "anulados",
] as const;

export type FiltroGastos = {
  desde: string;
  hasta: string;
  /** `""` = todas, `"general"` = sin sucursal, o el id. */
  sucursal: string;
  categoria: CategoriaGasto | null;
  conceptoId: number | null;
  medio: MedioPagoGasto | null;
  incluirAnulados: boolean;
  /** Filtro sin la condición de anulados: los totales siempre los excluyen. */
  base: Prisma.GastoWhereInput;
  /** Filtro de las filas que se muestran (o se exportan). */
  where: Prisma.GastoWhereInput;
  /** Si hay algún filtro aplicado además de los valores por defecto. */
  filtrando: boolean;
};

/**
 * Arma el filtro a partir de los parámetros de la URL. El empleado solo ve los
 * gastos de caja de su sucursal de los últimos `DIAS_EMPLEADO` días, y los
 * parámetros que mande para salir de eso se ignoran.
 */
export function filtroDeGastos(
  usuario: UsuarioActivo,
  parametros: Readonly<Record<string, string>>,
  hoy: string = diaDelNegocio(),
): FiltroGastos {
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  const desde = esAdmin
    ? esDiaValido(parametros.desde ?? "")
      ? parametros.desde!
      : `${hoy.slice(0, 8)}01`
    : sumarDias(hoy, -DIAS_EMPLEADO);
  const hasta = esAdmin && esDiaValido(parametros.hasta ?? "") ? parametros.hasta! : hoy;
  const sucursal = esAdmin ? (parametros.sucursal ?? "") : "";
  const categoria = CATEGORIAS_GASTO.find((c) => c === parametros.categoria) ?? null;
  const conceptoId =
    esAdmin && /^\d{1,9}$/.test(parametros.concepto ?? "") ? Number(parametros.concepto) : null;
  const medio = esAdmin ? (MEDIOS_GASTO.find((m) => m === parametros.medio) ?? null) : null;
  const incluirAnulados = !esAdmin || parametros.anulados === "1";

  const base: Prisma.GastoWhereInput = {
    fecha: { gte: inicioYFinDelDia(desde).inicio, lt: inicioYFinDelDia(hasta).fin },
  };
  if (esAdmin) {
    if (sucursal === "general") base.sucursalId = null;
    else if (/^\d{1,9}$/.test(sucursal)) base.sucursalId = Number(sucursal);
    if (categoria) base.concepto = { categoria };
    if (conceptoId) base.conceptoId = conceptoId;
    if (medio) base.medioPago = medio;
  } else {
    base.sucursalId = usuario.sucursalId;
    base.medioPago = "EFECTIVO_CAJA";
  }
  const where: Prisma.GastoWhereInput = { ...base, ...(incluirAnulados ? {} : { anulado: false }) };

  const filtrando =
    Boolean(parametros.desde || parametros.hasta || sucursal || categoria || conceptoId || medio) ||
    parametros.anulados === "1";

  return { desde, hasta, sucursal, categoria, conceptoId, medio, incluirAnulados, base, where, filtrando };
}

/** Query string con el filtro de la URL actual, para paginar o exportar sin perderlo. */
export function consultaDeFiltro(
  parametros: Readonly<Record<string, string>>,
  extra: Readonly<Record<string, string>> = {},
): string {
  const p = new URLSearchParams();
  for (const clave of PARAMETROS_FILTRO) {
    const valor = parametros[clave];
    if (valor) p.set(clave, valor);
  }
  for (const [clave, valor] of Object.entries(extra)) p.set(clave, valor);
  return p.toString();
}
