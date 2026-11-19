import { Prisma, type MetodoPago, type PrismaClient } from "@prisma/client";

import { textoMonto } from "@/lib/calculos";
import { diaDelNegocio, inicioYFinDelDia } from "@/lib/fecha";

import type { TotalesCierre } from "./tipos";

/*
 * Cuentas del cierre de caja.
 *
 * Un cierre se queda con las ventas de la sucursal que todavía no tienen
 * cierre (`cierreCajaId` nulo) y con las anulaciones que tampoco. Acá están
 * las dos vistas de esa cuenta: lo pendiente (vista previa, sin escribir) y lo
 * ya asignado a un cierre (lo que se guarda).
 */

type Db = PrismaClient | Prisma.TransactionClient;

const CERO = new Prisma.Decimal(0);

export type EstadoCaja = {
  cierreAnterior: { id: number; fecha: Date; fondoSiguiente: Prisma.Decimal } | null;
  /**
   * Piso de la cadena de cierres: las ventas registradas antes nunca entran
   * en un cierre. Es el `desde` del primer cierre de la sucursal o, si todavía
   * no hay ninguno, el inicio del día del negocio.
   */
  inicioCadena: Date;
  /** Inicio del período que se mostraría: el cierre anterior o el piso. */
  desde: Date;
};

export async function estadoCaja(db: Db, sucursalId: number): Promise<EstadoCaja> {
  const [anterior, primero] = await Promise.all([
    db.cierreCaja.findFirst({
      where: { sucursalId },
      orderBy: { id: "desc" },
      select: { id: true, fecha: true, fondoSiguiente: true },
    }),
    db.cierreCaja.findFirst({
      where: { sucursalId },
      orderBy: { id: "asc" },
      select: { desde: true },
    }),
  ]);

  const inicioCadena = primero?.desde ?? inicioYFinDelDia(diaDelNegocio()).inicio;
  return { cierreAnterior: anterior, inicioCadena, desde: anterior?.fecha ?? inicioCadena };
}

type PorMetodo = { metodoPago: MetodoPago; _sum: { total: Prisma.Decimal | null }; _count: { _all: number } }[];

function armarTotales(
  porMetodo: PorMetodo,
  devoluciones: Prisma.Decimal | null,
  fondoInicial: Prisma.Decimal,
): TotalesCierre {
  const metodo = (m: MetodoPago) =>
    porMetodo.find((p) => p.metodoPago === m)?._sum.total ?? CERO;
  const efectivo = metodo("EFECTIVO");
  const devuelto = devoluciones ?? CERO;

  return {
    fondoInicial: textoMonto(fondoInicial),
    ventasEfectivo: textoMonto(efectivo),
    devolucionesEfectivo: textoMonto(devuelto),
    ventasTransferencia: textoMonto(metodo("TRANSFERENCIA")),
    ventasTarjeta: textoMonto(metodo("TARJETA")),
    ventasFiado: textoMonto(metodo("FIADO")),
    cantidadVentas: porMetodo.reduce((suma, p) => suma + p._count._all, 0),
    esperado: textoMonto(fondoInicial.plus(efectivo).minus(devuelto)),
  };
}

/** Lo que entraría en un cierre si se hiciera ahora. Solo lectura. */
export async function totalesPendientes(
  db: Db,
  sucursalId: number,
  inicioCadena: Date,
  fondoInicial: Prisma.Decimal,
): Promise<TotalesCierre> {
  const [porMetodo, devoluciones] = await Promise.all([
    db.venta.groupBy({
      by: ["metodoPago"],
      where: { sucursalId, cierreCajaId: null, creadoEn: { gte: inicioCadena }, anulada: false },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // Ventas en efectivo ya cerradas cuya anulación todavía no entró en un cierre.
    db.venta.aggregate({
      where: {
        sucursalId,
        metodoPago: "EFECTIVO",
        cierreCajaId: { not: null },
        anulacion: { is: { cierreCajaId: null } },
      },
      _sum: { total: true },
    }),
  ]);
  return armarTotales(porMetodo, devoluciones._sum.total, fondoInicial);
}

/** Importes de un cierre a partir de lo que ya tiene asignado. */
export async function totalesDeCierre(
  db: Db,
  cierreId: number,
  fondoInicial: Prisma.Decimal,
): Promise<TotalesCierre> {
  const [porMetodo, devoluciones] = await Promise.all([
    db.venta.groupBy({
      by: ["metodoPago"],
      where: { cierreCajaId: cierreId, anulada: false },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // Anulaciones de este cierre cuya venta era de un cierre anterior. Las de
    // ventas de este mismo cierre ya quedaron fuera por `anulada`.
    db.venta.aggregate({
      where: {
        metodoPago: "EFECTIVO",
        AND: [{ cierreCajaId: { not: null } }, { cierreCajaId: { not: cierreId } }],
        anulacion: { is: { cierreCajaId: cierreId } },
      },
      _sum: { total: true },
    }),
  ]);
  return armarTotales(porMetodo, devoluciones._sum.total, fondoInicial);
}
