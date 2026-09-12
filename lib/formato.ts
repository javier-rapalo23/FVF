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

export function cantidad(valor: Numerico, unidad: UnidadVenta): string {
  const n = aNumero(valor);
  const formateada =
    unidad === "PESO" ? CANTIDAD_PESO.format(n) : ENTERO.format(n);
  return `${formateada} ${sufijoUnidad(unidad)}`;
}
