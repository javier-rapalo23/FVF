import { Prisma, type TipoMovimientoCuenta } from "@prisma/client";

import { aDecimal, type ValorDecimal } from "./calculos";

/**
 * Saldo de la cuenta corriente de un cliente: lo que debe.
 *
 * `CARGO` suma; `ABONO` (dinero cobrado) y `ANULACION` (reversa de una venta
 * a fiado anulada) restan.
 */
export function calcularSaldo(
  movimientos: readonly { tipo: TipoMovimientoCuenta; monto: ValorDecimal | null }[],
): Prisma.Decimal {
  return movimientos.reduce<Prisma.Decimal>((saldo, { tipo, monto }) => {
    if (monto === null) return saldo;
    return tipo === "CARGO" ? saldo.plus(monto) : saldo.minus(monto);
  }, aDecimal(0));
}

type Db = Prisma.TransactionClient;

/**
 * Saldos de varios clientes con una sola consulta agrupada por cliente y tipo
 * (no una por cliente). Sin `clienteIds`, de todos. Un cliente sin
 * movimientos no aparece en el mapa: su saldo es cero.
 */
export async function saldosDeClientes(
  db: Db,
  clienteIds?: readonly number[],
): Promise<Map<number, Prisma.Decimal>> {
  const sumas = await db.movimientoCuenta.groupBy({
    by: ["clienteId", "tipo"],
    where: clienteIds ? { clienteId: { in: [...clienteIds] } } : undefined,
    _sum: { monto: true },
  });

  const porCliente = new Map<number, { tipo: TipoMovimientoCuenta; monto: Prisma.Decimal | null }[]>();
  for (const suma of sumas) {
    const lista = porCliente.get(suma.clienteId) ?? [];
    lista.push({ tipo: suma.tipo, monto: suma._sum.monto });
    porCliente.set(suma.clienteId, lista);
  }

  return new Map(
    [...porCliente].map(([clienteId, movimientos]) => [clienteId, calcularSaldo(movimientos)]),
  );
}

export async function saldoDeCliente(db: Db, clienteId: number): Promise<Prisma.Decimal> {
  const saldos = await saldosDeClientes(db, [clienteId]);
  return saldos.get(clienteId) ?? aDecimal(0);
}
