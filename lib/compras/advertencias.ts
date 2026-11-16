import { aDecimal, type ValorDecimal } from "@/lib/calculos";
import { VARIACION_COSTO_AVISO } from "@/lib/config";
import { formatoMoneda } from "@/lib/formato";

/*
 * Avisos de una línea de compra. Ninguno bloquea: pueden ser ofertas o cambios
 * de precio reales, pero casi siempre delatan un error de tipeo. Funciones
 * puras para que el formulario las muestre mientras se escribe.
 */

export type AdvertenciaLinea =
  | { tipo: "VENTA_A_PERDIDA"; mensaje: string }
  | { tipo: "VARIACION_COSTO"; mensaje: string };

export function advertenciasLinea({
  costo,
  precioMinorista,
  precioMayorista,
  costoAnterior,
}: {
  costo: ValorDecimal;
  precioMinorista: ValorDecimal;
  precioMayorista: ValorDecimal;
  costoAnterior: ValorDecimal | null;
}): AdvertenciaLinea[] {
  const avisos: AdvertenciaLinea[] = [];
  const c = aDecimal(costo);
  if (c.lte(0)) return avisos;

  if (c.gte(precioMinorista)) {
    avisos.push({
      tipo: "VENTA_A_PERDIDA",
      mensaje: `El costo iguala o supera el precio minorista (${formatoMoneda(precioMinorista)}).`,
    });
  } else if (c.gte(precioMayorista)) {
    avisos.push({
      tipo: "VENTA_A_PERDIDA",
      mensaje: `El costo iguala o supera el precio mayorista (${formatoMoneda(precioMayorista)}).`,
    });
  }

  if (costoAnterior !== null) {
    const anterior = aDecimal(costoAnterior);
    if (anterior.gt(0)) {
      const variacion = c.minus(anterior).div(anterior);
      if (variacion.abs().gt(VARIACION_COSTO_AVISO)) {
        const porcentaje = variacion.mul(100).toDecimalPlaces(0).toNumber();
        avisos.push({
          tipo: "VARIACION_COSTO",
          mensaje: `${porcentaje > 0 ? "+" : ""}${porcentaje} % respecto del último costo (${formatoMoneda(anterior)}).`,
        });
      }
    }
  }

  return avisos;
}

/** Margen sobre el precio de venta: `(precio − costo) / precio`, en %. */
export function margenSobrePrecio(costo: ValorDecimal, precio: ValorDecimal): number | null {
  const p = aDecimal(precio);
  if (p.lte(0)) return null;
  return p.minus(costo).div(p).mul(100).toDecimalPlaces(0).toNumber();
}
