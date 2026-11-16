import { Prisma, type UnidadVenta } from "@prisma/client";

import { CANTIDAD_MAXIMA_LINEA } from "@/lib/config";

/*
 * Aritmética de ventas y compras. Funciones puras sobre `Prisma.Decimal`,
 * nunca sobre `number`: corren igual en el servidor (que decide) y en la
 * pantalla (que solo muestra), así que lo que se ve es lo que se registra.
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
 * - mayor que cero y hasta `maximo` (por defecto, el tope de caja);
 * - por peso, hasta 3 decimales;
 * - por unidad o paquete, entera.
 *
 * Sin `unidad` valida solo la forma general (lo que el servidor puede
 * comprobar antes de cargar los productos).
 */
export function validarCantidad(
  texto: string,
  unidad?: UnidadVenta,
  maximo: number = CANTIDAD_MAXIMA_LINEA,
): ResultadoCantidad {
  const limpio = texto.trim();
  if (!PATRON_CANTIDAD.test(limpio)) {
    return { valida: false, mensaje: "Ingresá una cantidad válida." };
  }

  const cantidad = aDecimal(limpio);
  if (cantidad.lte(0)) {
    return { valida: false, mensaje: "La cantidad tiene que ser mayor que cero." };
  }
  if (cantidad.gt(maximo)) {
    return { valida: false, mensaje: `Máximo ${maximo} por línea.` };
  }
  if (cantidad.decimalPlaces() > 3) {
    return { valida: false, mensaje: "Hasta 3 decimales." };
  }
  if (unidad && unidad !== "PESO" && !cantidad.isInteger()) {
    return { valida: false, mensaje: "Este producto se vende por unidades enteras." };
  }

  return { valida: true, cantidad };
}

/** Monto positivo con hasta 2 decimales, dentro de `Decimal(10,2)`. */
const PATRON_MONTO = /^\d{1,8}(\.\d{1,2})?$/;

export type ResultadoMonto =
  | { valido: true; monto: Prisma.Decimal }
  | { valido: false; mensaje: string };

/** Costo o precio unitario: mayor que cero, hasta 2 decimales. */
export function validarMontoPositivo(texto: string): ResultadoMonto {
  const limpio = texto.trim();
  if (!PATRON_MONTO.test(limpio)) {
    return { valido: false, mensaje: "Ingresá un monto válido, con hasta 2 decimales." };
  }
  const monto = aDecimal(limpio);
  if (monto.lte(0)) return { valido: false, mensaje: "Tiene que ser mayor que cero." };
  return { valido: true, monto };
}
