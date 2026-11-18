import { Prisma } from "@prisma/client";

import { textoCantidad, textoMonto } from "@/lib/calculos";
import { DIAS_AVISO_VENCIMIENTO } from "@/lib/config";
import { diasHasta, fechaISO } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { avisosVentasOffline } from "./avisos";
import type { FilaInventario } from "./tipos";

const CERO = new Prisma.Decimal(0);

/** Filtros rápidos de la pantalla, en el orden en que se muestran. */
export const FILTROS_INVENTARIO = [
  { valor: "", label: "Todos" },
  { valor: "bajo", label: "Stock bajo" },
  { valor: "negativo", label: "Negativo" },
  { valor: "vence", label: "Vencidos o por vencer" },
  { valor: "sin-costo", label: "Sin costo" },
] as const;

export type FiltroInventario = (typeof FILTROS_INVENTARIO)[number]["valor"];

export function esFiltroInventario(valor: string): valor is FiltroInventario {
  return FILTROS_INVENTARIO.some((f) => f.valor === valor);
}

export function cumpleFiltro(fila: FilaInventario, filtro: FiltroInventario): boolean {
  switch (filtro) {
    case "bajo":
      return fila.alertas.bajo;
    case "negativo":
      return fila.alertas.negativo;
    case "vence":
      return fila.alertas.vence;
    case "sin-costo":
      return fila.alertas.sinCosto;
    default:
      return true;
  }
}

/**
 * Inventario de una sucursal: los productos activos, más los inactivos que
 * todavía tienen stock (distinto de cero) para que no queden fuera de la
 * valorización ni de los conteos.
 */
export async function inventarioDeSucursal(sucursalId: number): Promise<FilaInventario[]> {
  const [productos, avisos] = await Promise.all([
    prisma.producto.findMany({
      where: {
        OR: [{ activo: true }, { stock: { some: { sucursalId, cantidad: { not: 0 } } } }],
      },
      select: {
        id: true,
        idInterno: true,
        nombre: true,
        unidadVenta: true,
        activo: true,
        fechaVencimiento: true,
        costoActual: true,
        stockMinimo: true,
        categoria: { select: { nombre: true } },
        stock: { where: { sucursalId }, select: { cantidad: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    avisosVentasOffline(sucursalId),
  ]);

  return productos.map((p) => {
    // Sin fila de stock todavía = 0 conocido, igual que en caja.
    const stock = p.stock[0]?.cantidad ?? CERO;
    const dias = p.fechaVencimiento ? diasHasta(p.fechaVencimiento) : null;
    const aviso = avisos.get(p.id);

    return {
      id: p.id,
      idInterno: p.idInterno,
      nombre: p.nombre,
      categoria: p.categoria.nombre,
      unidadVenta: p.unidadVenta,
      activo: p.activo,
      stock: textoCantidad(stock),
      stockMinimo: p.stockMinimo === null ? null : textoCantidad(p.stockMinimo),
      costoActual: p.costoActual === null ? null : textoMonto(p.costoActual),
      valor:
        p.costoActual !== null && stock.gt(0) ? textoMonto(stock.mul(p.costoActual)) : null,
      vencimiento: p.fechaVencimiento ? fechaISO(p.fechaVencimiento) : null,
      diasVencimiento: dias,
      alertas: {
        bajo: p.stockMinimo !== null && stock.lt(p.stockMinimo),
        negativo: stock.lt(0),
        // Solo importa si queda mercadería: un vencido sin stock no es alerta.
        vence: dias !== null && dias <= DIAS_AVISO_VENCIMIENTO && stock.gt(0),
        sinCosto: p.costoActual === null,
      },
      avisoOffline: aviso
        ? { ventas: aviso.ventas, ultimoConteo: aviso.ultimoConteo.toISOString() }
        : null,
    };
  });
}

/** Suma de `valor` de las filas (las que no tienen valor no suman). */
export function valorTotal(filas: readonly FilaInventario[]): Prisma.Decimal {
  return filas.reduce((suma, f) => (f.valor ? suma.plus(f.valor) : suma), CERO);
}
