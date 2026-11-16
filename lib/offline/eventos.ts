/*
 * Avisos entre las partes de la caja offline: la cola cambió, una venta se
 * sincronizó, cambió el estado de la red o venció la sesión.
 *
 * Llegan a la misma pestaña (EventTarget) y a las demás (BroadcastChannel),
 * para que el indicador y la caja de otra pestaña se enteren de lo que hace
 * el motor de sincronización.
 */

export type EventoCaja =
  | { tipo: "cola" }
  | { tipo: "sincronizada"; claveIdempotencia: string; ventaId: number }
  | { tipo: "red"; enLinea: boolean }
  | { tipo: "sesion"; vencida: boolean };

const CANAL = "ferrera-caja";
/** Identifica la pestaña: el canal también entrega en la propia pestaña y se duplicaría. */
const PESTANA = Math.random().toString(36).slice(2);

const local = typeof window === "undefined" ? null : new EventTarget();
let emisor: BroadcastChannel | null = null;

type Mensaje = { pestana: string; evento: EventoCaja };

export function emitir(evento: EventoCaja): void {
  local?.dispatchEvent(new CustomEvent<EventoCaja>("caja", { detail: evento }));
  try {
    emisor ??= new BroadcastChannel(CANAL);
    emisor.postMessage({ pestana: PESTANA, evento } satisfies Mensaje);
  } catch {
    // Sin BroadcastChannel solo se pierde el aviso a otras pestañas.
  }
}

export function escuchar(alRecibir: (evento: EventoCaja) => void): () => void {
  if (!local) return () => {};

  const enPestana = (e: Event) => alRecibir((e as CustomEvent<EventoCaja>).detail);
  local.addEventListener("caja", enPestana);

  let receptor: BroadcastChannel | null = null;
  try {
    receptor = new BroadcastChannel(CANAL);
    receptor.onmessage = (e: MessageEvent<Mensaje>) => {
      if (e.data?.pestana !== PESTANA) alRecibir(e.data.evento);
    };
  } catch {
    receptor = null;
  }

  return () => {
    local.removeEventListener("caja", enPestana);
    receptor?.close();
  };
}

// --------------------------------------------------------------- Red

let enLinea: boolean | null = null;

/**
 * Estado de la conexión según el último pedido al servidor. `navigator.onLine`
 * solo dice si hay una red, no si el servidor responde: por eso cuenta lo que
 * pasó de verdad con cada fetch.
 */
export function reportarRed(ok: boolean): void {
  if (enLinea === ok) return;
  enLinea = ok;
  emitir({ tipo: "red", enLinea: ok });
}

/** Error de red (sin respuesta) o tiempo de espera agotado, no un error HTTP. */
export function esFallaDeRed(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))
  );
}
