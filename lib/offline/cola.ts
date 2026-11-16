import { abrirBase } from "./db";
import { emitir } from "./eventos";
import type { VentaPendiente } from "./tipos";

/*
 * Cola de ventas cobradas sin conexión, en orden de llegada. Una venta solo
 * sale de acá cuando el servidor confirma que la registró, o cuando un
 * administrador la descarta después de bajar el respaldo.
 */

export async function encolarVenta(venta: VentaPendiente): Promise<void> {
  const db = await abrirBase();
  await db.put("ventasPendientes", venta);
  emitir({ tipo: "cola" });
}

/** Todas las ventas pendientes, de la más vieja a la más nueva. */
export async function listarPendientes(): Promise<VentaPendiente[]> {
  try {
    const db = await abrirBase();
    return await db.getAllFromIndex("ventasPendientes", "creadoEn");
  } catch {
    return [];
  }
}

export async function contarPendientes(): Promise<number> {
  try {
    const db = await abrirBase();
    return await db.count("ventasPendientes");
  } catch {
    return 0;
  }
}

export async function actualizarPendiente(
  claveIdempotencia: string,
  cambios: Partial<Omit<VentaPendiente, "claveIdempotencia">>,
): Promise<void> {
  const db = await abrirBase();
  const tx = db.transaction("ventasPendientes", "readwrite");
  const actual = await tx.store.get(claveIdempotencia);
  if (actual) await tx.store.put({ ...actual, ...cambios });
  await tx.done;
  emitir({ tipo: "cola" });
}

export async function quitarPendiente(claveIdempotencia: string): Promise<void> {
  const db = await abrirBase();
  await db.delete("ventasPendientes", claveIdempotencia);
  emitir({ tipo: "cola" });
}

/** Vuelve una venta en ERROR (o en espera) a la cola, para reintentar ya. */
export async function reintentarPendiente(claveIdempotencia: string): Promise<void> {
  await actualizarPendiente(claveIdempotencia, {
    estado: "PENDIENTE",
    proximoIntento: 0,
  });
}

/** Descarga un JSON con las ventas: el respaldo antes de descartar o ante cualquier duda. */
export function descargarRespaldo(ventas: readonly VentaPendiente[], nombre: string): void {
  const blob = new Blob([JSON.stringify(ventas, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
