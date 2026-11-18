import type { TipoAjusteStock, UnidadVenta } from "@prisma/client";

/*
 * Contrato entre la pantalla de inventario y sus server actions. No importa
 * nada de servidor: lo usan también los diálogos. Las cantidades viajan como
 * strings, igual que en caja y compras.
 */

export type PayloadConteo = {
  productoId: number;
  /** Solo para el administrador sin sucursal asignada. */
  sucursalId: number | null;
  /** Cantidad contada, en la unidad de venta del producto. Puede ser "0". */
  cantidad: string;
  /** Opcional: por defecto, "Conteo físico". */
  motivo: string | null;
};

export type PayloadMerma = {
  productoId: number;
  sucursalId: number | null;
  /** Cantidad perdida, positiva. */
  cantidad: string;
  /** Obligatorio: dañado, vencido, robado… */
  motivo: string;
};

export type PayloadConteoLote = {
  sucursalId: number | null;
  /** Solo los productos que se contaron. */
  items: { productoId: number; cantidad: string }[];
  motivo: string | null;
};

export type CodigoErrorInventario =
  | "PAYLOAD_INVALIDO"
  | "SIN_PERMISO"
  | "SUCURSAL_REQUERIDA"
  | "PRODUCTO_NO_ENCONTRADO"
  | "PRODUCTO_REPETIDO"
  | "CANTIDAD_INVALIDA"
  | "MOTIVO_INVALIDO";

export type ErrorInventarioSerializado = {
  ok: false;
  codigo: CodigoErrorInventario;
  mensaje: string;
  /** Producto al que se refiere el error, para marcar la fila. */
  productoId?: number;
};

/** Un ajuste ya aplicado, tal como lo muestra la pantalla. */
export type AjusteAplicado = {
  productoId: number;
  nombre: string;
  unidadVenta: UnidadVenta;
  tipo: TipoAjusteStock;
  /** Diferencia aplicada, con signo. */
  cantidad: string;
  stockAnterior: string;
  stockResultante: string;
};

export type ResultadoAjuste = ({ ok: true } & AjusteAplicado) | ErrorInventarioSerializado;

export type ResultadoConteoLote =
  | {
      ok: true;
      /** Ajustes creados: uno por producto contado, aunque la diferencia sea 0. */
      contados: number;
      /** Solo los que cambiaron el stock. */
      conDiferencia: AjusteAplicado[];
    }
  | ErrorInventarioSerializado;

/** Error de negocio con código estable. Las acciones lo devuelven serializado. */
export class ErrorInventario extends Error {
  constructor(
    readonly codigo: CodigoErrorInventario,
    mensaje: string,
    readonly extra: { productoId?: number } = {},
  ) {
    super(mensaje);
    this.name = "ErrorInventario";
  }

  serializar(): ErrorInventarioSerializado {
    return { ok: false, codigo: this.codigo, mensaje: this.message, ...this.extra };
  }
}

/** Fila de la pantalla de inventario. */
export type FilaInventario = {
  id: number;
  idInterno: number;
  nombre: string;
  categoria: string;
  unidadVenta: UnidadVenta;
  activo: boolean;
  stock: string;
  stockMinimo: string | null;
  costoActual: string | null;
  /** `stock × costoActual`, solo con stock positivo y costo conocido. */
  valor: string | null;
  /** `YYYY-MM-DD`. */
  vencimiento: string | null;
  /** Días hasta el vencimiento; negativo si ya venció. */
  diasVencimiento: number | null;
  alertas: { bajo: boolean; negativo: boolean; vence: boolean; sinCosto: boolean };
  /** Ventas sin conexión sincronizadas después del último conteo y cobradas antes. */
  avisoOffline: { ventas: number; ultimoConteo: string } | null;
};
