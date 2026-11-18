import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/*
 * Historial de movimientos de un producto en una sucursal (kardex).
 *
 * No hay tabla de movimientos: se arma uniendo las fuentes que ya existen.
 * Cada movimiento se ubica en el momento en que tocó el stock, que no siempre
 * es la "fecha" del documento: una compra entra al registrarse (`creadoEn`),
 * no el día de la factura, y una venta sin conexión descuenta al
 * sincronizarse, no cuando se cobró.
 *
 * El saldo se calcula hacia atrás desde el stock actual, así coincide siempre
 * con la fila de `Stock` aunque haya movimientos anteriores a este módulo
 * (stock inicial cargado a mano, por ejemplo).
 */

export type TipoMovimientoKardex =
  | "VENTA"
  | "ANULACION_VENTA"
  | "COMPRA"
  | "ANULACION_COMPRA"
  | "CONTEO"
  | "MERMA";

export type MovimientoKardex = {
  clave: string;
  fecha: Date;
  tipo: TipoMovimientoKardex;
  /** Con signo: positivo entra, negativo sale. */
  cantidad: Prisma.Decimal;
  /** Stock después de este movimiento. */
  saldo: Prisma.Decimal;
  usuario: string;
  referencia: { texto: string; href: string | null };
  /** Motivo, proveedor o aclaración. */
  detalle: string | null;
};

export type Kardex = {
  stockActual: Prisma.Decimal;
  /** Stock al empezar el período mostrado. */
  saldoInicial: Prisma.Decimal;
  /** Stock al terminar el período mostrado. */
  saldoFinal: Prisma.Decimal;
  entradas: Prisma.Decimal;
  salidas: Prisma.Decimal;
  /** En orden cronológico. */
  movimientos: MovimientoKardex[];
  /**
   * Si el período tenía demasiadas ventas o compras, se muestran solo los
   * movimientos desde este instante. Los saldos siguen siendo exactos.
   */
  recortadoDesde: Date | null;
};

/** Tope de líneas de venta y de compra que se leen por consulta. */
const LIMITE_POR_FUENTE = 1500;

const CERO = new Prisma.Decimal(0);

type Movimiento = Omit<MovimientoKardex, "saldo">;

export async function kardexProducto({
  productoId,
  sucursalId,
  inicio,
  fin,
}: {
  productoId: number;
  sucursalId: number;
  /** Rango `[inicio, fin)`. */
  inicio: Date;
  fin: Date;
}): Promise<Kardex> {
  const rango = { gte: inicio, lt: fin };

  const [
    stock,
    ventas,
    anulacionesVenta,
    compras,
    anulacionesCompra,
    ajustes,
    netoPosterior,
  ] = await Promise.all([
    prisma.stock.findUnique({
      where: { productoId_sucursalId: { productoId, sucursalId } },
      select: { cantidad: true },
    }),
    prisma.detalleVenta.findMany({
      where: { productoId, venta: { sucursalId, creadoEn: rango } },
      select: {
        id: true,
        cantidad: true,
        venta: {
          select: {
            id: true,
            fecha: true,
            creadoEn: true,
            origenOffline: true,
            anulada: true,
            usuario: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ venta: { creadoEn: "desc" } }, { id: "desc" }],
      take: LIMITE_POR_FUENTE + 1,
    }),
    prisma.detalleVenta.findMany({
      where: {
        productoId,
        venta: { sucursalId, anulacion: { is: { reingresaStock: true, fecha: rango } } },
      },
      select: {
        id: true,
        cantidad: true,
        venta: {
          select: {
            id: true,
            anulacion: {
              select: { fecha: true, motivo: true, usuario: { select: { nombre: true } } },
            },
          },
        },
      },
    }),
    prisma.detalleCompra.findMany({
      where: { productoId, compra: { sucursalId, creadoEn: rango } },
      select: {
        id: true,
        cantidad: true,
        compra: {
          select: {
            id: true,
            creadoEn: true,
            numeroFactura: true,
            proveedor: { select: { nombre: true } },
            usuario: { select: { nombre: true } },
          },
        },
      },
      orderBy: [{ compra: { creadoEn: "desc" } }, { id: "desc" }],
      take: LIMITE_POR_FUENTE + 1,
    }),
    prisma.detalleCompra.findMany({
      where: { productoId, compra: { sucursalId, anulacion: { is: { fecha: rango } } } },
      select: {
        id: true,
        cantidad: true,
        compra: {
          select: {
            id: true,
            anulacion: {
              select: { fecha: true, motivo: true, usuario: { select: { nombre: true } } },
            },
          },
        },
      },
    }),
    prisma.ajusteStock.findMany({
      where: { productoId, sucursalId, fecha: rango },
      select: {
        id: true,
        tipo: true,
        cantidad: true,
        fecha: true,
        motivo: true,
        usuario: { select: { nombre: true } },
      },
    }),
    netoDesde(productoId, sucursalId, fin),
  ]);

  // Si una fuente se cortó por el tope, todo lo anterior a su movimiento más
  // viejo queda afuera: mostrarlo sin esa fuente daría saldos falsos.
  const cortes: Date[] = [];
  if (ventas.length > LIMITE_POR_FUENTE) {
    ventas.length = LIMITE_POR_FUENTE;
    cortes.push(ventas[ventas.length - 1]!.venta.creadoEn);
  }
  if (compras.length > LIMITE_POR_FUENTE) {
    compras.length = LIMITE_POR_FUENTE;
    cortes.push(compras[compras.length - 1]!.compra.creadoEn);
  }
  const recortadoDesde =
    cortes.length === 0 ? null : new Date(Math.max(...cortes.map((c) => c.getTime())));

  const movimientos: Movimiento[] = [
    ...ventas.map((d): Movimiento => {
      const aclaraciones = [
        d.venta.origenOffline ? "Sin conexión" : null,
        d.venta.anulada ? "Anulada después" : null,
      ].filter(Boolean);
      return {
        clave: `v${d.id}`,
        fecha: d.venta.creadoEn,
        tipo: "VENTA",
        cantidad: d.cantidad.neg(),
        usuario: d.venta.usuario.nombre,
        referencia: { texto: `Venta N° ${d.venta.id}`, href: `/caja/ventas/${d.venta.id}` },
        detalle: aclaraciones.length > 0 ? aclaraciones.join(" · ") : null,
      };
    }),
    ...anulacionesVenta.map((d): Movimiento => ({
      clave: `av${d.id}`,
      fecha: d.venta.anulacion!.fecha,
      tipo: "ANULACION_VENTA",
      cantidad: d.cantidad,
      usuario: d.venta.anulacion!.usuario.nombre,
      referencia: { texto: `Venta N° ${d.venta.id}`, href: `/caja/ventas/${d.venta.id}` },
      detalle: d.venta.anulacion!.motivo,
    })),
    ...compras.map((d): Movimiento => ({
      clave: `c${d.id}`,
      fecha: d.compra.creadoEn,
      tipo: "COMPRA",
      cantidad: d.cantidad,
      usuario: d.compra.usuario.nombre,
      referencia: { texto: `Compra N° ${d.compra.id}`, href: `/compras/${d.compra.id}` },
      detalle: [d.compra.proveedor.nombre, d.compra.numeroFactura ? `fact. ${d.compra.numeroFactura}` : null]
        .filter(Boolean)
        .join(" · "),
    })),
    ...anulacionesCompra.map((d): Movimiento => ({
      clave: `ac${d.id}`,
      fecha: d.compra.anulacion!.fecha,
      tipo: "ANULACION_COMPRA",
      cantidad: d.cantidad.neg(),
      usuario: d.compra.anulacion!.usuario.nombre,
      referencia: { texto: `Compra N° ${d.compra.id}`, href: `/compras/${d.compra.id}` },
      detalle: d.compra.anulacion!.motivo,
    })),
    ...ajustes.map((a): Movimiento => ({
      clave: `a${a.id}`,
      fecha: a.fecha,
      tipo: a.tipo,
      cantidad: a.cantidad,
      usuario: a.usuario.nombre,
      referencia: { texto: `Ajuste N° ${a.id}`, href: null },
      detalle: a.motivo,
    })),
  ].filter((m) => !recortadoDesde || m.fecha >= recortadoDesde);

  // Del más nuevo al más viejo: así se descuenta cada movimiento del saldo.
  movimientos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.clave.localeCompare(a.clave));

  const stockActual = stock?.cantidad ?? CERO;
  const saldoFinal = stockActual.minus(netoPosterior);
  let saldo = saldoFinal;
  let entradas = CERO;
  let salidas = CERO;
  const conSaldo: MovimientoKardex[] = movimientos.map((m) => {
    const fila = { ...m, saldo };
    saldo = saldo.minus(m.cantidad);
    if (m.cantidad.gt(0)) entradas = entradas.plus(m.cantidad);
    else salidas = salidas.plus(m.cantidad.neg());
    return fila;
  });

  return {
    stockActual,
    saldoInicial: saldo,
    saldoFinal,
    entradas,
    salidas,
    movimientos: conSaldo.reverse(),
    recortadoDesde,
  };
}

/**
 * Efecto neto sobre el stock de todo lo ocurrido desde `desde` (inclusive).
 * Sirve para llevar el stock actual al final del período mostrado.
 */
async function netoDesde(
  productoId: number,
  sucursalId: number,
  desde: Date,
): Promise<Prisma.Decimal> {
  if (desde.getTime() > Date.now()) return CERO;
  const despues = { gte: desde };

  const [ventas, anulacionesVenta, compras, anulacionesCompra, ajustes] = await Promise.all([
    prisma.detalleVenta.aggregate({
      where: { productoId, venta: { sucursalId, creadoEn: despues } },
      _sum: { cantidad: true },
    }),
    prisma.detalleVenta.aggregate({
      where: {
        productoId,
        venta: { sucursalId, anulacion: { is: { reingresaStock: true, fecha: despues } } },
      },
      _sum: { cantidad: true },
    }),
    prisma.detalleCompra.aggregate({
      where: { productoId, compra: { sucursalId, creadoEn: despues } },
      _sum: { cantidad: true },
    }),
    prisma.detalleCompra.aggregate({
      where: { productoId, compra: { sucursalId, anulacion: { is: { fecha: despues } } } },
      _sum: { cantidad: true },
    }),
    prisma.ajusteStock.aggregate({
      where: { productoId, sucursalId, fecha: despues },
      _sum: { cantidad: true },
    }),
  ]);

  const suma = (valor: Prisma.Decimal | null) => valor ?? CERO;
  return suma(compras._sum.cantidad)
    .plus(suma(anulacionesVenta._sum.cantidad))
    .plus(suma(ajustes._sum.cantidad))
    .minus(suma(ventas._sum.cantidad))
    .minus(suma(anulacionesCompra._sum.cantidad));
}
