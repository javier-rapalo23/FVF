import { Prisma, type UnidadVenta } from "@prisma/client";

import { CANTIDAD_MAXIMA_LINEA } from "@/lib/config";

/*
 * Aritmética de la venta. Funciones puras sobre `Prisma.Decimal`, nunca sobre
 * `number`: corren igual en el servidor (que decide) y en la caja (que solo
 * muestra), así que lo que ve el empleado es lo que se cobra.
 */

export type ValorDecimal = string | number | Prisma.Decimal;

const CERO = new Prisma.Decimal(0);

export function aDecimal(valor: ValorDecimal): Prisma.Decimal {
  return new Prisma.Decimal(valor);
}

/** Redondeo de dinero: 2 decimales, mitad hacia arriba. */
export function redondearMonto(valor: ValorDecimal): Prisma.Decimal {
  return aDecimal(valor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** `cantidad × precioUnitario`, redondeado a 2 decimales. */
export function calcularSubtotal(
  cantidad: ValorDecimal,
  precioUnitario: ValorDecimal,
): Prisma.Decimal {
  return redondearMonto(aDecimal(cantidad).mul(precioUnitario));
}

/** Suma de subtotales (ya redondeados, así que la suma es exacta). */
export function calcularTotal(subtotales: readonly ValorDecimal[]): Prisma.Decimal {
  return subtotales.reduce<Prisma.Decimal>((suma, s) => suma.plus(s), CERO);
}

/** Vuelto del pago en efectivo. Negativo si lo recibido no alcanza. */
export function calcularVuelto(recibido: ValorDecimal, total: ValorDecimal): Prisma.Decimal {
  return redondearMonto(aDecimal(recibido).minus(total));
}

/** Formato de la API: montos con 2 decimales. */
export function textoMonto(valor: ValorDecimal): string {
  return aDecimal(valor).toFixed(2);
}

/** Formato de la API: cantidades y stock con 3 decimales. */
export function textoCantidad(valor: ValorDecimal): string {
  return aDecimal(valor).toFixed(3);
}

/** Número decimal positivo escrito con punto, sin signo ni exponente. */
const PATRON_CANTIDAD = /^\d+(\.\d+)?$/;

export type ResultadoCantidad =
  | { valida: true; cantidad: Prisma.Decimal }
  | { valida: false; mensaje: string };

/**
 * Regla de cantidad por línea:
 * - mayor que cero y hasta `CANTIDAD_MAXIMA_LINEA`;
 * - por peso, hasta 3 decimales;
 * - por unidad o paquete, entera.
 *
 * Sin `unidad` valida solo la forma general (lo que el servidor puede
 * comprobar antes de cargar los productos).
 */
export function validarCantidad(texto: string, unidad?: UnidadVenta): ResultadoCantidad {
  const limpio = texto.trim();
  if (!PATRON_CANTIDAD.test(limpio)) {
    return { valida: false, mensaje: "Ingresá una cantidad válida." };
  }

  const cantidad = aDecimal(limpio);
  if (cantidad.lte(0)) {
    return { valida: false, mensaje: "La cantidad tiene que ser mayor que cero." };
  }
  if (cantidad.gt(CANTIDAD_MAXIMA_LINEA)) {
    return { valida: false, mensaje: `Máximo ${CANTIDAD_MAXIMA_LINEA} por línea.` };
  }
  if (cantidad.decimalPlaces() > 3) {
    return { valida: false, mensaje: "Hasta 3 decimales." };
  }
  if (unidad && unidad !== "PESO" && !cantidad.isInteger()) {
    return { valida: false, mensaje: "Este producto se vende por unidades enteras." };
  }

  return { valida: true, cantidad };
}
