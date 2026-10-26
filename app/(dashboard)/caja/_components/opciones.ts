import type { MetodoPago } from "@prisma/client";

/*
 * Etiquetas compartidas entre la pantalla de caja (cliente) y los listados y
 * el comprobante (servidor). Vive fuera de los componentes "use client"
 * porque un Server Component no puede leer valores exportados de uno.
 */
export const NOMBRE_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  FIADO: "Fiado",
};
