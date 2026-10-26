import type { Canal, Prisma } from "@prisma/client";

import type { ResultadoCantidad } from "@/lib/ventas/calculos";
import type { ProductoCatalogo } from "@/lib/ventas/tipos";

/** Línea del carrito. `cantidad` es el texto tal cual lo escribe el empleado. */
export type LineaCarrito = { uid: string; productoId: number; cantidad: string };

export type Carrito = {
  /** Una por carrito: los reintentos de cobro la reutilizan. */
  claveIdempotencia: string;
  canal: Canal;
  clienteId: number | null;
  notas: string;
  lineas: LineaCarrito[];
};

/** Línea ya resuelta contra el catálogo, lista para mostrar. */
export type FilaCarrito = {
  linea: LineaCarrito;
  /** `null` si el producto ya no está en el catálogo (desactivado). */
  producto: ProductoCatalogo | null;
  cantidad: ResultadoCantidad | null;
  precioUnitario: Prisma.Decimal | null;
  subtotal: Prisma.Decimal | null;
  superaStock: boolean;
  vencido: boolean;
};

/**
 * UUID v4. `crypto.randomUUID` solo existe en contextos seguros (https o
 * localhost); si la caja se abre por http desde la red local, se arma a mano.
 */
export function nuevaClave(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function carritoVacio(): Carrito {
  return {
    claveIdempotencia: nuevaClave(),
    canal: "LOCAL",
    clienteId: null,
    notas: "",
    lineas: [],
  };
}

export function estaVacio(carrito: Carrito): boolean {
  return (
    carrito.lineas.length === 0 &&
    carrito.clienteId === null &&
    carrito.canal === "LOCAL" &&
    !carrito.notas
  );
}

/** Búsqueda sin acentos ni mayúsculas. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Acepta coma decimal al tipear el peso ("1,5" → "1.5"). */
export function normalizarCantidad(texto: string): string {
  return texto.trim().replace(",", ".");
}

// ------------------------------------------------- Respaldo ante recarga

/*
 * El carrito en curso sobrevive a una recarga accidental. Se guarda solo lo
 * mínimo (sin precios: se recalculan siempre desde el catálogo), por usuario,
 * y todo acceso a `localStorage` va en try/catch: en modo privado o con el
 * almacenamiento bloqueado puede fallar.
 */

const claveCarrito = (usuarioId: number) => `ferrera:caja:carrito:${usuarioId}`;
const claveSucursal = (usuarioId: number) => `ferrera:caja:sucursal:${usuarioId}`;

type CarritoGuardado = {
  claveIdempotencia: string;
  canal: Canal;
  clienteId: number | null;
  notas: string;
  lineas: { productoId: number; cantidad: string }[];
};

export function guardarCarrito(usuarioId: number, carrito: Carrito): void {
  try {
    if (estaVacio(carrito)) {
      localStorage.removeItem(claveCarrito(usuarioId));
      return;
    }
    const guardado: CarritoGuardado = {
      claveIdempotencia: carrito.claveIdempotencia,
      canal: carrito.canal,
      clienteId: carrito.clienteId,
      notas: carrito.notas,
      lineas: carrito.lineas.map(({ productoId, cantidad }) => ({ productoId, cantidad })),
    };
    localStorage.setItem(claveCarrito(usuarioId), JSON.stringify(guardado));
  } catch {
    // Sin almacenamiento la caja sigue funcionando; solo se pierde el respaldo.
  }
}

export function leerCarrito(usuarioId: number): Carrito | null {
  try {
    const crudo = localStorage.getItem(claveCarrito(usuarioId));
    if (!crudo) return null;

    const g = JSON.parse(crudo) as Partial<CarritoGuardado>;
    if (
      typeof g.claveIdempotencia !== "string" ||
      (g.canal !== "LOCAL" && g.canal !== "PEDIDO") ||
      !(g.clienteId === null || typeof g.clienteId === "number") ||
      typeof g.notas !== "string" ||
      !Array.isArray(g.lineas)
    ) {
      return null;
    }

    return {
      claveIdempotencia: g.claveIdempotencia,
      canal: g.canal,
      clienteId: g.clienteId,
      notas: g.notas,
      lineas: g.lineas
        .filter(
          (l): l is { productoId: number; cantidad: string } =>
            typeof l?.productoId === "number" && typeof l?.cantidad === "string",
        )
        .map((l) => ({ uid: nuevaClave(), productoId: l.productoId, cantidad: l.cantidad })),
    };
  } catch {
    return null;
  }
}

export function guardarSucursal(usuarioId: number, sucursalId: number): void {
  try {
    localStorage.setItem(claveSucursal(usuarioId), String(sucursalId));
  } catch {
    // Ídem: solo se pierde la preferencia.
  }
}

export function leerSucursal(usuarioId: number): number | null {
  try {
    const valor = Number(localStorage.getItem(claveSucursal(usuarioId)));
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
}
