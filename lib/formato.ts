import type { UnidadVenta } from "@prisma/client";

/**
 * Formateo de cifras para la interfaz.
 *
 * El peso chileno no usa decimales, pero el schema guarda `Decimal(10,2)`, así
 * que el redondeo de presentación se resuelve acá y no en cada pantalla.
 */
const PESOS = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const ENTERO = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

/** Cantidades por peso: hasta 3 decimales, sin ceros de relleno inútiles. */
const CANTIDAD_PESO = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

/** Acepta el `Decimal` de Prisma, que llega serializado como string. */
export type Numerico = number | string;

export function aNumero(valor: Numerico): number {
  return typeof valor === "number" ? valor : Number(valor);
}

export function precio(valor: Numerico): string {
  return PESOS.format(aNumero(valor));
}

/** Monto sin el símbolo, para tablas donde la columna ya dice que es dinero. */
export function monto(valor: Numerico): string {
  return ENTERO.format(Math.round(aNumero(valor)));
}

/** Sufijo corto de la unidad de venta. */
export function sufijoUnidad(unidad: UnidadVenta): string {
  switch (unidad) {
    case "PESO":
      return "kg";
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
 * muestran y comparan en UTC para que no "retrocedan" un día con el huso de
 * Chile. El "hoy" sí se toma en hora local del negocio.
 */
const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const HOY_LOCAL = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });

const MS_DIA = 86_400_000;

export function fecha(valor: Date): string {
  return FECHA.format(valor);
}

/** `YYYY-MM-DD`, el formato de `<input type="date">`. */
export function fechaISO(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/** Días desde hoy (hora de Chile) hasta la fecha. Negativo si ya pasó. */
export function diasHasta(valor: Date): number {
  const hoy = new Date(`${HOY_LOCAL.format(new Date())}T00:00:00.000Z`);
  return Math.round((valor.getTime() - hoy.getTime()) / MS_DIA);
}

export function cantidad(valor: Numerico, unidad: UnidadVenta): string {
  const n = aNumero(valor);
  const formateada =
    unidad === "PESO" ? CANTIDAD_PESO.format(n) : ENTERO.format(n);
  return `${formateada} ${sufijoUnidad(unidad)}`;
}
