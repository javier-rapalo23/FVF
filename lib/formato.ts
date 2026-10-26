import type { Prisma, UnidadVenta } from "@prisma/client";

import { UNIDAD_PESO } from "@/lib/config";
import { diaDelNegocio } from "@/lib/fecha";

/**
 * Formateo de cifras para la interfaz.
 *
 * Los montos son lempiras con dos decimales. El símbolo se arma a mano en vez
 * de usar `style: "currency"` para que servidor y navegador produzcan
 * exactamente el mismo texto (el ICU de cada uno puede variar el espacio).
 */
const DOS_DECIMALES = new Intl.NumberFormat("es-HN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ENTERO = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 0 });

/** Cantidades por peso: hasta 3 decimales, sin ceros de relleno inútiles. */
const CANTIDAD_PESO = new Intl.NumberFormat("es-HN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

/** Acepta el `Decimal` de Prisma, o su serialización como string. */
export type Numerico = number | string | Prisma.Decimal;

export function aNumero(valor: Numerico): number {
  return typeof valor === "number" ? valor : Number(valor.toString());
}

/** Único formato de dinero de la app: `L 1,234.50`. */
export function formatoMoneda(valor: Numerico): string {
  const numero = aNumero(valor);
  // `-0` se mostraría como "L -0.00".
  const signo = numero < 0 && Math.abs(numero) >= 0.005 ? "-" : "";
  return `${signo}L ${DOS_DECIMALES.format(Math.abs(numero))}`;
}

/** Monto sin el símbolo, para tablas donde la columna ya dice que es dinero. */
export function monto(valor: Numerico): string {
  return DOS_DECIMALES.format(aNumero(valor));
}

/** Sufijo corto de la unidad de venta. */
export function sufijoUnidad(unidad: UnidadVenta): string {
  switch (unidad) {
    case "PESO":
      return UNIDAD_PESO;
    case "PAQUETE":
      return "paq";
    case "UNIDAD":
    default:
      return "un";
  }
}

/** Cuánto suma o resta un toque al stepper, según cómo se vende el producto. */
export function pasoUnidad(unidad: UnidadVenta): number {
  return unidad === "PESO" ? 0.1 : 1;
}

/*
 * Fechas sin hora (vencimientos): se guardan a medianoche UTC, así que se
 * muestran y comparan en UTC para que no "retrocedan" un día con el huso del
 * negocio. El "hoy" sí se toma en hora local del negocio.
 */
const FECHA = new Intl.DateTimeFormat("es-HN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const MS_DIA = 86_400_000;

export function fecha(valor: Date): string {
  return FECHA.format(valor);
}

/** `YYYY-MM-DD`, el formato de `<input type="date">`. */
export function fechaISO(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/** Días desde hoy (hora del negocio) hasta la fecha. Negativo si ya pasó. */
export function diasHasta(valor: Date): number {
  const hoy = new Date(`${diaDelNegocio()}T00:00:00.000Z`);
  return Math.round((valor.getTime() - hoy.getTime()) / MS_DIA);
}

export function cantidad(valor: Numerico, unidad: UnidadVenta): string {
  const n = aNumero(valor);
  const formateada =
    unidad === "PESO" ? CANTIDAD_PESO.format(n) : ENTERO.format(n);
  return `${formateada} ${sufijoUnidad(unidad)}`;
}
