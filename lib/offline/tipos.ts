import type { UnidadVenta } from "@prisma/client";

import type { Catalogo, PayloadVenta } from "@/lib/ventas/tipos";

/*
 * Datos que la caja guarda en el dispositivo para seguir vendiendo sin
 * conexión. Solo se usan en el navegador.
 */

/** Última respuesta de `GET /api/caja/catalogo`, por usuario y sucursal pedida. */
export type RegistroCatalogo = {
  clave: string;
  usuarioId: number;
  catalogo: Catalogo;
  /** Reloj del dispositivo al pedirlo: se compara con el de los envíos, nunca con el del servidor. */
  obtenidoEn: number;
};

export type EstadoPendiente = "PENDIENTE" | "SINCRONIZANDO" | "ERROR";

/** Lo necesario para mostrar e imprimir la venta sin volver a consultar el catálogo. */
export type ResumenVenta = {
  sucursalNombre: string;
  usuarioNombre: string;
  clienteNombre: string | null;
  total: string;
  lineas: {
    productoId: number;
    nombre: string;
    unidadVenta: UnidadVenta;
    cantidad: string;
    precioUnitario: string;
    subtotal: string;
  }[];
};

export type VentaPendiente = {
  claveIdempotencia: string;
  /** Payload completo, ya con `origenOffline`, `fechaCliente`, `usuarioIdOrigen` y precios. */
  payload: PayloadVenta;
  usuarioId: number;
  sucursalId: number;
  fechaCliente: string;
  estado: EstadoPendiente;
  intentos: number;
  ultimoError: string | null;
  /** No se reintenta antes de este momento (espera creciente). */
  proximoIntento: number;
  /** Orden FIFO de la cola. */
  creadoEn: number;
  resumen: ResumenVenta;
};
