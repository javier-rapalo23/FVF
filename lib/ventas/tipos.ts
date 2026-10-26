import type { Canal, MetodoPago, TipoCliente, UnidadVenta } from "@prisma/client";

/*
 * Contrato de la API de caja. Lo comparten los Route Handlers y la pantalla de
 * caja, así que este módulo no puede importar nada de servidor. Los decimales
 * (montos, cantidades, stock) viajan siempre como strings.
 */

// --------------------------------------------------------------- Catálogo

export type ProductoCatalogo = {
  id: number;
  idInterno: number;
  codigoBarras: string | null;
  nombre: string;
  categoria: { id: number; nombre: string };
  unidadVenta: UnidadVenta;
  precioMinorista: string;
  precioMayorista: string;
  /** ISO, guardada a medianoche UTC. */
  fechaVencimiento: string | null;
  stock: string;
};

export type ClienteCatalogo = {
  id: number;
  nombre: string;
  tipo: TipoCliente;
  fiadoHabilitado: boolean;
  /** `null` = sin tope. */
  limiteCredito: string | null;
  saldo: string;
};

export type Catalogo = {
  sucursal: { id: number; nombre: string };
  generadoEn: string;
  productos: ProductoCatalogo[];
  clientes: ClienteCatalogo[];
};

// ----------------------------------------------------------------- Ventas

export type ItemVenta = { productoId: number; cantidad: string };

export type PayloadVenta = {
  claveIdempotencia: string;
  canal: Canal;
  clienteId: number | null;
  metodoPago: MetodoPago;
  sucursalId: number | null;
  notas: string | null;
  confirmarExcesoCredito: boolean;
  items: ItemVenta[];
};

export type AdvertenciaVenta = {
  tipo: "STOCK_NEGATIVO";
  productoId: number;
  stockResultante: string;
};

export type RespuestaVenta = {
  ventaId: number;
  total: string;
  yaRegistrada: boolean;
  advertencias: AdvertenciaVenta[];
};

export type PayloadAnulacion = { motivo: string; reingresaStock: boolean };

// ---------------------------------------------------------------- Errores

export type CodigoError =
  | "SIN_SESION"
  | "SIN_PERMISO"
  | "PAYLOAD_INVALIDO"
  | "CANTIDAD_INVALIDA"
  | "SUCURSAL_REQUERIDA"
  | "PRODUCTO_NO_DISPONIBLE"
  | "CLIENTE_REQUERIDO"
  | "CLIENTE_INACTIVO"
  | "FIADO_NO_HABILITADO"
  | "LIMITE_CREDITO_EXCEDIDO"
  | "VENTA_NO_ENCONTRADA"
  | "VENTA_YA_ANULADA"
  | "MOTIVO_INVALIDO"
  | "ERROR_INTERNO";

/** Forma de toda respuesta de error: `{ error, mensaje, ...datos }`. */
export type RespuestaError = {
  error: CodigoError;
  mensaje: string;
  [dato: string]: unknown;
};

/** Datos extra de `LIMITE_CREDITO_EXCEDIDO`. */
export type DatosExcesoCredito = {
  saldo: string;
  limite: string;
  total: string;
  exceso: string;
  /** Solo un administrador puede reenviar con `confirmarExcesoCredito`. */
  puedeConfirmar: boolean;
};

/** Error de negocio: los servicios lo lanzan y el Route Handler lo traduce a JSON. */
export class ErrorVenta extends Error {
  constructor(
    readonly codigo: CodigoError,
    readonly http: number,
    mensaje: string,
    readonly datos: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = "ErrorVenta";
  }
}
