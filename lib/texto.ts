/*
 * Utilidades de texto e identificadores que comparten las pantallas de caja y
 * compras. Puras y sin dependencias de servidor.
 */

/**
 * UUID v4. `crypto.randomUUID` solo existe en contextos seguros (https o
 * localhost); si la app se abre por http desde la red local, se arma a mano.
 */
export function nuevaClave(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Búsqueda sin acentos ni mayúsculas. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Acepta coma decimal al tipear ("1,5" → "1.5"). */
export function normalizarCantidad(texto: string): string {
  return texto.trim().replace(",", ".");
}
