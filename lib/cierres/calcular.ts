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

/** Movimientos de efectivo del cajón que no son ventas. */
type Salidas = {
  devoluciones: Prisma.Decimal | null;
  gastos: Prisma.Decimal | null;
  abonos: Prisma.Decimal | null;
  pagosProveedor: Prisma.Decimal | null;
};

function armarTotales(
  porMetodo: PorMetodo,
  { devoluciones, gastos, abonos, pagosProveedor }: Salidas,
  fondoInicial: Prisma.Decimal,
): TotalesCierre {
  const metodo = (m: MetodoPago) =>
    porMetodo.find((p) => p.metodoPago === m)?._sum.total ?? CERO;
  const efectivo = metodo("EFECTIVO");
  const devuelto = devoluciones ?? CERO;
  const gastado = gastos ?? CERO;
  const abonado = abonos ?? CERO;
  const pagado = pagosProveedor ?? CERO;

  return {
    fondoInicial: textoMonto(fondoInicial),
    ventasEfectivo: textoMonto(efectivo),
    devolucionesEfectivo: textoMonto(devuelto),
    ventasTransferencia: textoMonto(metodo("TRANSFERENCIA")),
    ventasTarjeta: textoMonto(metodo("TARJETA")),
    ventasFiado: textoMonto(metodo("FIADO")),
    cantidadVentas: porMetodo.reduce((suma, p) => suma + p._count._all, 0),
    gastosCaja: textoMonto(gastado),
    abonosEfectivo: textoMonto(abonado),
    pagosProveedorCaja: textoMonto(pagado),
    esperado: textoMonto(
      fondoInicial.plus(efectivo).minus(devuelto).plus(abonado).minus(pagado).minus(gastado),
    ),
  };
}

/**
 * Gastos de caja que todavía no entraron en un cierre. Mismo piso que las
 * ventas: lo registrado antes del primer cierre de la sucursal no entra.
 */
export function filtroGastosPendientes(sucursalId: number, inicioCadena: Date): Prisma.GastoWhereInput {
  return {
    sucursalId,
    medioPago: "EFECTIVO_CAJA",
    cierreCajaId: null,
    creadoEn: { gte: inicioCadena },
  };
}

/**
 * Abonos de clientes cobrados en efectivo en la caja de la sucursal, todavía
 * sin cierre. Mismo piso que las ventas.
 */
export function filtroAbonosPendientes(
  sucursalId: number,
  inicioCadena: Date,
): Prisma.MovimientoCuentaWhereInput {
  return {
    tipo: "ABONO",
    medioPago: "EFECTIVO",
    sucursalId,
    cierreCajaId: null,
    fecha: { gte: inicioCadena },
  };
}

/** Pagos a proveedores con el efectivo del cajón, todavía sin cierre. */
export function filtroPagosProveedorPendientes(
  sucursalId: number,
  inicioCadena: Date,
): Prisma.MovimientoProveedorWhereInput {
  return {
    tipo: "PAGO",
    medioPago: "EFECTIVO_CAJA",
    sucursalId,
    cierreCajaId: null,
    fecha: { gte: inicioCadena },
  };
}

/** Lo que entraría en un cierre si se hiciera ahora. Solo lectura. */
export async function totalesPendientes(
  db: Db,
  sucursalId: number,
  inicioCadena: Date,
  fondoInicial: Prisma.Decimal,
): Promise<TotalesCierre> {
  const [porMetodo, devoluciones, gastos, abonos, pagos] = await Promise.all([
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
    db.gasto.aggregate({
      where: { ...filtroGastosPendientes(sucursalId, inicioCadena), anulado: false },
      _sum: { monto: true },
    }),
    db.movimientoCuenta.aggregate({
      where: filtroAbonosPendientes(sucursalId, inicioCadena),
      _sum: { monto: true },
    }),
    db.movimientoProveedor.aggregate({
      where: filtroPagosProveedorPendientes(sucursalId, inicioCadena),
      _sum: { monto: true },
    }),
  ]);
  return armarTotales(
    porMetodo,
    {
      devoluciones: devoluciones._sum.total,
      gastos: gastos._sum.monto,
      abonos: abonos._sum.monto,
      pagosProveedor: pagos._sum.monto,
    },
    fondoInicial,
  );
}

/** Importes de un cierre a partir de lo que ya tiene asignado. */
export async function totalesDeCierre(
  db: Db,
  cierreId: number,
  fondoInicial: Prisma.Decimal,
): Promise<TotalesCierre> {
  const [porMetodo, devoluciones, gastos, abonos, pagos] = await Promise.all([
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
    // Se asignan también los anulados antes del cierre, pero no restan.
    db.gasto.aggregate({
      where: { cierreCajaId: cierreId, anulado: false },
      _sum: { monto: true },
    }),
    db.movimientoCuenta.aggregate({ where: { cierreCajaId: cierreId }, _sum: { monto: true } }),
    db.movimientoProveedor.aggregate({ where: { cierreCajaId: cierreId }, _sum: { monto: true } }),
  ]);
  return armarTotales(
    porMetodo,
    {
      devoluciones: devoluciones._sum.total,
      gastos: gastos._sum.monto,
      abonos: abonos._sum.monto,
      pagosProveedor: pagos._sum.monto,
    },
    fondoInicial,
  );
}

/**
 * Efectivo que debería haber ahora en la caja de cada sucursal, para avisar
 * al administrador si una salida lo supera. Nunca se calcula para el empleado
 * (conteo a ciegas). Sin un cierre anterior no se conoce el fondo: no se avisa.
 */
export async function esperadosActuales(
  db: Db,
  sucursalIds: readonly number[],
): Promise<Record<number, string>> {
  const valores = await Promise.all(
    sucursalIds.map(async (id) => {
      const estado = await estadoCaja(db, id);
      if (!estado.cierreAnterior) return null;
      const totales = await totalesPendientes(
        db,
        id,
        estado.inicioCadena,
        estado.cierreAnterior.fondoSiguiente,
      );
      return [id, totales.esperado] as const;
    }),
  );
  return Object.fromEntries(valores.filter((v) => v !== null));
}
