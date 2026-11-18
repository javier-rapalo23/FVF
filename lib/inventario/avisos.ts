import { HORAS_AVISO_VENTA_OFFLINE } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export type AvisoOffline = { ventas: number; ultimoConteo: Date };

/**
 * Productos cuyo último conteo pudo quedar desfasado por una venta sin
 * conexión: cobrada antes del conteo (`fecha`) pero sincronizada después
 * (`creadoEn`), dentro de las últimas `HORAS_AVISO_VENTA_OFFLINE` horas.
 *
 * Esa venta descontó stock que el conteo ya reflejaba. No se corrige sola:
 * la pantalla avisa para que se vuelva a contar.
 */
export async function avisosVentasOffline(
  sucursalId: number,
  productoIds?: readonly number[],
): Promise<Map<number, AvisoOffline>> {
  const avisos = new Map<number, AvisoOffline>();
  const desde = new Date(Date.now() - HORAS_AVISO_VENTA_OFFLINE * 60 * 60 * 1000);
  const filtroProductos = productoIds ? { productoId: { in: [...productoIds] } } : {};

  const ventas = await prisma.venta.findMany({
    where: {
      sucursalId,
      origenOffline: true,
      creadoEn: { gte: desde },
      detalles: { some: filtroProductos },
    },
    select: {
      fecha: true,
      creadoEn: true,
      detalles: { where: filtroProductos, select: { productoId: true } },
    },
  });
  if (ventas.length === 0) return avisos;

  const ids = [...new Set(ventas.flatMap((v) => v.detalles.map((d) => d.productoId)))];
  const conteos = await prisma.ajusteStock.groupBy({
    by: ["productoId"],
    where: { sucursalId, tipo: "CONTEO", productoId: { in: ids } },
    _max: { fecha: true },
  });
  const ultimoConteo = new Map(conteos.map((c) => [c.productoId, c._max.fecha]));

  for (const venta of ventas) {
    // Una venta con dos líneas del mismo producto cuenta una sola vez.
    for (const productoId of new Set(venta.detalles.map((d) => d.productoId))) {
      const conteo = ultimoConteo.get(productoId);
      if (!conteo || venta.fecha >= conteo || venta.creadoEn <= conteo) continue;
      const previo = avisos.get(productoId);
      avisos.set(productoId, { ventas: (previo?.ventas ?? 0) + 1, ultimoConteo: conteo });
    }
  }
  return avisos;
}
