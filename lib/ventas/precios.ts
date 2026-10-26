import type { Prisma, TipoCliente } from "@prisma/client";

import { aDecimal, type ValorDecimal } from "./calculos";

/**
 * Precio unitario de un producto según el cliente de la venta.
 *
 * Mayorista paga `precioMayorista`; minorista o venta sin cliente, el
 * minorista. La cantidad mínima mayorista no se aplica: manda el tipo de
 * cliente. El servidor decide con esta función; la caja la usa solo para
 * mostrar el mismo número.
 */
export function precioSegunCliente(
  producto: { precioMinorista: ValorDecimal; precioMayorista: ValorDecimal },
  tipoCliente: TipoCliente | null | undefined,
): Prisma.Decimal {
  return aDecimal(
    tipoCliente === "MAYORISTA" ? producto.precioMayorista : producto.precioMinorista,
  );
}
