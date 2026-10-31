import type { Rol } from "@prisma/client";

import type { RespuestaError, RespuestaVenta } from "@/lib/ventas/tipos";

import { asentarVentaSincronizada } from "./catalogo-local";
import { actualizarPendiente, contarPendientes, listarPendientes, quitarPendiente } from "./cola";
import { emitir, esFallaDeRed, reportarRed } from "./eventos";
import type { VentaPendiente } from "./tipos";

/*
 * Sincronización de la cola de ventas offline.
 *
 * La hace la propia app y no Background Sync, que Safari/iOS no tiene. Se
 * dispara al cargar la página, al volver la conexión (`online`), cada 15 s
 * mientras haya cola y la pestaña esté visible, y con "Sincronizar ahora".
 *
 * Va en orden de llegada y de a una venta. Reintentar es seguro: la clave de
 * idempotencia hace que el servidor devuelva la venta original si ya llegó.
 */

const INTERVALO_MS = 15_000;
const ESPERA_ENVIO_MS = 15_000;
const REINTENTO_BASE_MS = 5_000;
const REINTENTO_MAXIMO_MS = 5 * 60_000;
const CANDADO = "ferrera-sincronizacion";

type Contexto = { usuarioId: number; rol: Rol };
type Resultado = "seguir" | "detener";

let contexto: Contexto | null = null;
let enCurso: Promise<void> | null = null;

/**
 * Arranca los disparadores automáticos. Lo llama el indicador de conexión del
 * layout, así la cola avanza desde cualquier pantalla. Devuelve la limpieza.
 */
export function iniciarMotor(nuevo: Contexto): () => void {
  contexto = nuevo;

  const alVolverRed = () => void sincronizar();
  const alCambiarVisibilidad = () => {
    if (document.visibilityState === "visible") void sincronizar();
  };
  const intervalo = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    void contarPendientes().then((n) => {
      if (n > 0) void sincronizar();
    });
  }, INTERVALO_MS);

  window.addEventListener("online", alVolverRed);
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  void recuperarInterrumpidas().then(() => sincronizar());

  return () => {
    clearInterval(intervalo);
    window.removeEventListener("online", alVolverRed);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  };
}

/**
 * Una pestaña cerrada a mitad de un envío deja la venta "sincronizando". Se
 * vuelve a la cola: si el envío había llegado, el servidor no la duplica.
 */
async function recuperarInterrumpidas(): Promise<void> {
  for (const venta of await listarPendientes()) {
    if (venta.estado === "SINCRONIZANDO") {
      await actualizarPendiente(venta.claveIdempotencia, { estado: "PENDIENTE" });
    }
  }
}

/** Recorre la cola. Con `forzar` ignora la espera entre reintentos (botón manual). */
export function sincronizar({ forzar = false }: { forzar?: boolean } = {}): Promise<void> {
  if (!contexto) return Promise.resolve();

  enCurso ??= conCandado(() => recorrer(forzar)).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

/** Una sola pestaña sincroniza a la vez (Web Locks); sin soporte, cada una por su cuenta. */
async function conCandado(tarea: () => Promise<void>): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(CANDADO, { ifAvailable: true }, async (candado) => {
      if (candado) await tarea();
    });
    return;
  }
  await tarea();
}

async function recorrer(forzar: boolean): Promise<void> {
  const ctx = contexto;
  if (!ctx) return;

  for (const venta of await listarPendientes()) {
    // Las que están en ERROR esperan a que alguien las revise.
    if (venta.estado !== "PENDIENTE") continue;
    // La venta de otro vendedor la sincroniza él o un administrador.
    if (ctx.rol !== "ADMINISTRADOR" && venta.usuarioId !== ctx.usuarioId) continue;
    // Orden de llegada: si la primera tiene que esperar, las demás también.
    if (!forzar && venta.proximoIntento > Date.now()) break;

    if ((await enviar(venta)) === "detener") break;
  }
}

async function enviar(venta: VentaPendiente): Promise<Resultado> {
  const clave = venta.claveIdempotencia;
  await actualizarPendiente(clave, { estado: "SINCRONIZANDO" });
  const enviadaEn = Date.now();

  let respuesta: Response;
  try {
    respuesta = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(venta.payload),
      signal: AbortSignal.timeout(ESPERA_ENVIO_MS),
    });
  } catch (error) {
    if (esFallaDeRed(error)) reportarRed(false);
    await posponer(venta, "Sin conexión con el servidor.");
    return "detener";
  }

  reportarRed(true);
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | RespuestaVenta
    | RespuestaError
    | null;

  if (respuesta.ok && cuerpo && !("error" in cuerpo)) {
    await asentarVentaSincronizada(venta, enviadaEn);
    await quitarPendiente(clave);
    emitir({ tipo: "sesion", vencida: false });
    emitir({ tipo: "sincronizada", claveIdempotencia: clave, ventaId: cuerpo.ventaId });
    return "seguir";
  }

  const mensaje =
    cuerpo && "mensaje" in cuerpo ? cuerpo.mensaje : `El servidor respondió ${respuesta.status}.`;

  // Sesión vencida: la cola queda intacta y se reanuda al volver a entrar.
  if (respuesta.status === 401) {
    await actualizarPendiente(clave, {
      estado: "PENDIENTE",
      ultimoError: "Sesión vencida: iniciá sesión para sincronizar.",
    });
    emitir({ tipo: "sesion", vencida: true });
    return "detener";
  }

  // Servidor caído o saturado: se reintenta más tarde.
  if (respuesta.status >= 500 || respuesta.status === 408 || respuesta.status === 429) {
    await posponer(venta, mensaje);
    return "detener";
  }

  // Cualquier otro rechazo (400, 403…) no se descarta jamás: queda en ERROR,
  // visible en /caja/pendientes hasta que alguien lo resuelva.
  await actualizarPendiente(clave, {
    estado: "ERROR",
    intentos: venta.intentos + 1,
    ultimoError: mensaje,
  });
  return "seguir";
}

async function posponer(venta: VentaPendiente, mensaje: string): Promise<void> {
  const intentos = venta.intentos + 1;
  const espera = Math.min(REINTENTO_BASE_MS * 2 ** (intentos - 1), REINTENTO_MAXIMO_MS);
  await actualizarPendiente(venta.claveIdempotencia, {
    estado: "PENDIENTE",
    intentos,
    ultimoError: mensaje,
    proximoIntento: Date.now() + espera,
  });
}
