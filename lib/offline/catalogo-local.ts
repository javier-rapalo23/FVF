import type { MetodoPago } from "@prisma/client";

import { aDecimal, textoCantidad, textoMonto } from "@/lib/ventas/calculos";
import type { Catalogo } from "@/lib/ventas/tipos";

import { abrirBase } from "./db";
import type { RegistroCatalogo, VentaPendiente } from "./tipos";

/** Un catálogo por usuario y sucursal pedida (`auto` = la que resuelva el servidor). */
export function claveCatalogo(usuarioId: number, sucursalPedida: number | null): string {
  return `${usuarioId}:${sucursalPedida ?? "auto"}`;
}

export async function leerCatalogo(clave: string): Promise<RegistroCatalogo | undefined> {
  try {
    const db = await abrirBase();
    return await db.get("catalogo", clave);
  } catch {
    return undefined;
  }
}

export async function guardarCatalogo(registro: RegistroCatalogo): Promise<void> {
  try {
    const db = await abrirBase();
    await db.put("catalogo", registro);
  } catch {
    // Sin almacenamiento la caja online sigue andando; solo no habrá respaldo.
  }
}

/** Al cerrar sesión: los saldos de clientes no quedan en el dispositivo. La cola sí. */
export async function borrarCatalogosDe(usuarioId: number): Promise<void> {
  try {
    const db = await abrirBase();
    const tx = db.transaction("catalogo", "readwrite");
    for (const registro of await tx.store.getAll()) {
      if (registro.usuarioId === usuarioId) await tx.store.delete(registro.clave);
    }
    await tx.done;
  } catch {
    // Nada que hacer: no había base.
  }
}

export type VentaLocal = {
  items: readonly { productoId: number; cantidad: string }[];
  clienteId: number | null;
  metodoPago: MetodoPago;
  total: string;
};

/** El catálogo como queda después de una venta: menos stock y, si es fiado, más saldo. */
export function aplicarVenta(catalogo: Catalogo, venta: VentaLocal): Catalogo {
  const salidas = new Map<number, ReturnType<typeof aDecimal>>();
  for (const item of venta.items) {
    salidas.set(item.productoId, (salidas.get(item.productoId) ?? aDecimal(0)).plus(item.cantidad));
  }

  return {
    ...catalogo,
    productos: catalogo.productos.map((p) => {
      const salida = salidas.get(p.id);
      return salida ? { ...p, stock: textoCantidad(aDecimal(p.stock).minus(salida)) } : p;
    }),
    clientes:
      venta.metodoPago === "FIADO" && venta.clienteId !== null
        ? catalogo.clientes.map((c) =>
            c.id === venta.clienteId
              ? { ...c, saldo: textoMonto(aDecimal(c.saldo).plus(venta.total)) }
              : c,
          )
        : catalogo.clientes,
  };
}

/** Catálogo a mostrar: el del servidor más lo que ya se vendió y espera en la cola. */
export function aplicarPendientes(
  catalogo: Catalogo,
  pendientes: readonly VentaPendiente[],
): Catalogo {
  return pendientes
    .filter((v) => v.sucursalId === catalogo.sucursal.id)
    .reduce(
      (actual, v) =>
        aplicarVenta(actual, {
          items: v.payload.items,
          clienteId: v.payload.clienteId,
          metodoPago: v.payload.metodoPago,
          total: v.resumen.total,
        }),
      catalogo,
    );
}

/**
 * Una venta de la cola ya está en el servidor: deja de contarse como
 * pendiente, así que se descuenta de los catálogos guardados que se pidieron
 * antes del envío (los posteriores ya la traen).
 */
export async function asentarVentaSincronizada(
  venta: VentaPendiente,
  enviadaEn: number,
): Promise<void> {
  try {
    const db = await abrirBase();
    const tx = db.transaction("catalogo", "readwrite");
    for (const registro of await tx.store.getAll()) {
      if (registro.catalogo.sucursal.id !== venta.sucursalId || registro.obtenidoEn >= enviadaEn) {
        continue;
      }
      await tx.store.put({
        ...registro,
        catalogo: aplicarVenta(registro.catalogo, {
          items: venta.payload.items,
          clienteId: venta.payload.clienteId,
          metodoPago: venta.payload.metodoPago,
          total: venta.resumen.total,
        }),
      });
    }
    await tx.done;
  } catch {
    // El próximo refresco del catálogo corrige cualquier diferencia.
  }
}
