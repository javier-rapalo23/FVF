import { Prisma, type TipoMovimientoProveedor } from "@prisma/client";

import { aDecimal, type ValorDecimal } from "@/lib/calculos";

/**
 * Saldo de la cuenta de un proveedor: lo que se le debe.
 *
 * `CARGO` (compra a crédito) suma; `PAGO` (dinero entregado) y `ANULACION`
 * (reversa de una compra anulada) restan.
 */
export function calcularSaldoProveedor(
  movimientos: readonly { tipo: TipoMovimientoProveedor; monto: ValorDecimal | null }[],
): Prisma.Decimal {
  return movimientos.reduce<Prisma.Decimal>((saldo, { tipo, monto }) => {
    if (monto === null) return saldo;
    return tipo === "CARGO" ? saldo.plus(monto) : saldo.minus(monto);
  }, aDecimal(0));
}

type Db = Prisma.TransactionClient;

/**
 * Saldos de varios proveedores con una sola consulta agrupada. Sin
 * `proveedorIds`, de todos. Un proveedor sin movimientos no aparece: debe cero.
 */
export async function saldosDeProveedores(
  db: Db,
  proveedorIds?: readonly number[],
): Promise<Map<number, Prisma.Decimal>> {
  const sumas = await db.movimientoProveedor.groupBy({
    by: ["proveedorId", "tipo"],
    where: proveedorIds ? { proveedorId: { in: [...proveedorIds] } } : undefined,
    _sum: { monto: true },
  });

  const porProveedor = new Map<
    number,
    { tipo: TipoMovimientoProveedor; monto: Prisma.Decimal | null }[]
  >();
  for (const suma of sumas) {
    const lista = porProveedor.get(suma.proveedorId) ?? [];
    lista.push({ tipo: suma.tipo, monto: suma._sum.monto });
    porProveedor.set(suma.proveedorId, lista);
  }

  return new Map(
    [...porProveedor].map(([id, movimientos]) => [id, calcularSaldoProveedor(movimientos)]),
  );
}

export async function saldoDeProveedor(db: Db, proveedorId: number): Promise<Prisma.Decimal> {
  const saldos = await saldosDeProveedores(db, [proveedorId]);
  return saldos.get(proveedorId) ?? aDecimal(0);
}
