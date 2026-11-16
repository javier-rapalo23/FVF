import type { CondicionPago, UnidadVenta } from "@prisma/client";

/*
 * Contrato entre la pantalla de compras y sus server actions. No importa nada
 * de servidor: lo usa también el formulario. Los decimales viajan como
 * strings, igual que en la caja.
 */

export type ItemCompra = {
  productoId: number;
  /** En la unidad de venta del producto, ej. "25.500". */
  cantidad: string;
  /** Costo por esa unidad, ISV incluido, ej. "12.50". */
  costoUnitario: string;
  /** `YYYY-MM-DD`: reemplaza el vencimiento del producto. */
  fechaVencimiento: string | null;
};

export type PayloadCompra = {
  claveIdempotencia: string;
  proveedorId: number;
  /** Solo para el administrador sin sucursal asignada. */
  sucursalId: number | null;
  /** Día de la factura, `YYYY-MM-DD`. */
  fecha: string;
  numeroFactura: string | null;
  condicionPago: CondicionPago;
  notas: string | null;
  items: ItemCompra[];
};

export type CodigoErrorCompra =
  | "PAYLOAD_INVALIDO"
  | "SIN_PERMISO"
  | "SUCURSAL_REQUERIDA"
  | "PROVEEDOR_INACTIVO"
  | "PROVEEDOR_NO_ENCONTRADO"
  | "PRODUCTO_NO_ENCONTRADO"
  | "PRODUCTO_INACTIVO"
  | "PRODUCTO_REPETIDO"
  | "CANTIDAD_INVALIDA"
  | "COSTO_INVALIDO"
  | "FECHA_INVALIDA"
  | "MOTIVO_INVALIDO"
  | "COMPRA_NO_ENCONTRADA"
  | "YA_ANULADA";

export type ErrorCompraSerializado = {
  ok: false;
  codigo: CodigoErrorCompra;
  mensaje: string;
  /** Línea a la que se refiere el error, para marcarla en pantalla. */
  productoId?: number;
  sucursales?: { id: number; nombre: string }[];
};

export type ResultadoRegistroCompra =
  | {
      ok: true;
      compraId: number;
      total: string;
      condicionPago: CondicionPago;
      /** La clave ya estaba registrada: es la misma compra, no una nueva. */
      yaRegistrada: boolean;
      /** Saldo por pagar al proveedor después de la compra (solo a crédito). */
      saldoProveedor: string | null;
      proveedor: string;
    }
  | ErrorCompraSerializado;

export type ResultadoAnulacionCompra =
  | {
      ok: true;
      /** Productos que quedaron con stock negativo al restar la compra. */
      stockNegativo: { nombre: string; stock: string; unidadVenta: UnidadVenta }[];
    }
  | ErrorCompraSerializado;

/** Error de negocio con código estable. Las acciones lo devuelven serializado. */
export class ErrorCompra extends Error {
  constructor(
    readonly codigo: CodigoErrorCompra,
    mensaje: string,
    readonly extra: { productoId?: number; sucursales?: { id: number; nombre: string }[] } = {},
  ) {
    super(mensaje);
    this.name = "ErrorCompra";
  }

  serializar(): ErrorCompraSerializado {
    return { ok: false, codigo: this.codigo, mensaje: this.message, ...this.extra };
  }
}

/** Producto tal como lo necesita el formulario de compra. */
export type ProductoCompra = {
  id: number;
  idInterno: number;
  codigoBarras: string | null;
  nombre: string;
  categoria: string;
  unidadVenta: UnidadVenta;
  proveedorId: number | null;
  precioMinorista: string;
  precioMayorista: string;
  costoActual: string | null;
};
