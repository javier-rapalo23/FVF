import { ZONA_HORARIA } from "@/lib/config";

/**
 * Fechas en la zona del negocio.
 *
 * Los timestamps se guardan en UTC y el servidor (Vercel) corre en UTC, así
 * que "hoy" nunca se calcula con `setHours(0,0,0,0)`: una venta de las 18:00
 * en Tegucigalpa ya es del día siguiente en UTC. Todo pasa por acá.
 */

/** `YYYY-MM-DD` en la zona del negocio (en-CA formatea justo así). */
const DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const PARTES = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

const HORA = new Intl.DateTimeFormat("es-HN", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const FECHA_HORA = new Intl.DateTimeFormat("es-HN", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-HN", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const PATRON_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Día calendario (`YYYY-MM-DD`) de un instante, en la zona del negocio. */
export function diaDelNegocio(instante: Date = new Date()): string {
  return DIA.format(instante);
}

export function esDiaValido(dia: string): boolean {
  if (!PATRON_DIA.test(dia)) return false;
  const fecha = new Date(`${dia}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(dia);
}

/**
 * Cuántos milisegundos está adelantada la zona del negocio respecto de UTC en
 * ese instante (negativo en América). Se calcula con `Intl` y no con una
 * constante para no romperse si la zona alguna vez adopta horario de verano.
 */
function desfaseZona(instante: Date): number {
  const p = Object.fromEntries(
    PARTES.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Instante UTC en que empieza un día (`YYYY-MM-DD`) en la zona del negocio. */
function inicioDeDia(dia: string): Date {
  const medianocheUtc = Date.parse(`${dia}T00:00:00.000Z`);
  return new Date(medianocheUtc - desfaseZona(new Date(medianocheUtc)));
}

function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Rango `[inicio, fin)` en UTC del día calendario del negocio que contiene a
 * `fecha`. Acepta un instante o un día `YYYY-MM-DD`. Para filtrar en Prisma:
 * `{ gte: inicio, lt: fin }`.
 */
export function inicioYFinDelDia(fecha: Date | string = new Date()): {
  inicio: Date;
  fin: Date;
} {
  const dia = typeof fecha === "string" ? fecha : diaDelNegocio(fecha);
  if (!esDiaValido(dia)) throw new Error(`Día inválido: ${dia}`);
  return { inicio: inicioDeDia(dia), fin: inicioDeDia(sumarDias(dia, 1)) };
}

/** Hora local del negocio, ej. "06:05 p. m.". */
export function formatoHora(instante: Date): string {
  return HORA.format(instante);
}

/** Fecha y hora local del negocio, para el comprobante. */
export function formatoFechaHora(instante: Date): string {
  return FECHA_HORA.format(instante);
}

/** "sábado, 25 de octubre de 2026" a partir de un día `YYYY-MM-DD`. */
export function formatoDiaLargo(dia: string): string {
  return FECHA_LARGA.format(new Date(`${dia}T12:00:00.000Z`));
}
