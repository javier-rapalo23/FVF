import { Prisma } from "@prisma/client";

import { textoMonto } from "@/lib/calculos";
import { prisma } from "@/lib/prisma";

import { efectoAnulacion } from "./anular";
import { NOMBRE_MEDIO_ABONO, NOMBRE_MEDIO_PAGO_PROVEEDOR, type FilaEstadoCuenta } from "./tipos";

/*
 * Estado de cuenta: los movimientos en orden, con el saldo que dejó cada uno.
 * El saldo acumulado se calcula sobre todos los movimientos; la pantalla
 * muestra los más recientes primero. Un abono o pago anulado sigue en la
 * lista, con su motivo, pero no mueve el saldo.
 */

const CERO = new Prisma.Decimal(0);

/** Cargos, abonos y anulaciones del fiado de un cliente. */
export async function estadoCuentaCliente(clienteId: number): Promise<FilaEstadoCuenta[]> {
  const movimientos = await prisma.movimientoCuenta.findMany({
    where: { clienteId },
    select: {
      id: true,
      fecha: true,
      tipo: true,
      monto: true,
      ventaId: true,
      medioPago: true,
      nota: true,
      cierreCajaId: true,
      anulado: true,
      anuladoEn: true,
      motivoAnulacion: true,
      usuario: { select: { nombre: true } },
      anuladoPor: { select: { nombre: true } },
    },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
  });

  let saldo = CERO;
  return movimientos.map((m) => {
    const importe = m.tipo === "CARGO" ? m.monto : m.monto.neg();
    if (!m.anulado) saldo = saldo.plus(importe);
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      origenId: m.ventaId,
      medio: m.medioPago ? NOMBRE_MEDIO_ABONO[m.medioPago] : null,
      usuario: m.usuario?.nombre ?? null,
      nota: m.nota,
      importe: textoMonto(importe),
      saldo: textoMonto(saldo),
      anulacion: m.anulado
        ? {
            fecha: m.anuladoEn ?? m.fecha,
            usuario: m.anuladoPor?.nombre ?? null,
            motivo: m.motivoAnulacion ?? "",
          }
        : null,
      efectoAnulacion:
        m.tipo === "ABONO" && !m.anulado
          ? efectoAnulacion(m.medioPago === "EFECTIVO", m.cierreCajaId)
          : null,
    };
  });
}

/** Compras a crédito, pagos y anulaciones de la cuenta de un proveedor. */
export async function estadoCuentaProveedor(proveedorId: number): Promise<FilaEstadoCuenta[]> {
  const movimientos = await prisma.movimientoProveedor.findMany({
    where: { proveedorId },
    select: {
      id: true,
      fecha: true,
      tipo: true,
      monto: true,
      compraId: true,
      medioPago: true,
      nota: true,
      cierreCajaId: true,
      anulado: true,
      anuladoEn: true,
      motivoAnulacion: true,
      usuario: { select: { nombre: true } },
      anuladoPor: { select: { nombre: true } },
    },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
  });

  let saldo = CERO;
  return movimientos.map((m) => {
    const importe = m.tipo === "CARGO" ? m.monto : m.monto.neg();
    if (!m.anulado) saldo = saldo.plus(importe);
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      origenId: m.compraId,
      medio: m.medioPago ? NOMBRE_MEDIO_PAGO_PROVEEDOR[m.medioPago] : null,
      usuario: m.usuario?.nombre ?? null,
      nota: m.nota,
      importe: textoMonto(importe),
      saldo: textoMonto(saldo),
      anulacion: m.anulado
        ? {
            fecha: m.anuladoEn ?? m.fecha,
            usuario: m.anuladoPor?.nombre ?? null,
            motivo: m.motivoAnulacion ?? "",
          }
        : null,
      efectoAnulacion:
        m.tipo === "PAGO" && !m.anulado
          ? efectoAnulacion(m.medioPago === "EFECTIVO_CAJA", m.cierreCajaId)
          : null,
    };
  });
}

/** Saldo que dejó un abono: los movimientos del cliente hasta él, inclusive. */
export async function saldoDespuesDeAbono(clienteId: number, abonoId: number): Promise<string> {
  const filas = await estadoCuentaCliente(clienteId);
  return filas.find((f) => f.id === abonoId)?.saldo ?? textoMonto(CERO);
}
