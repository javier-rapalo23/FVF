import type { MedioAbono, MedioPagoProveedor } from "@prisma/client";

/*
 * Contrato entre las pantallas de cuentas (abonos de clientes y pagos a
 * proveedores) y sus server actions. No importa nada de servidor: lo usan
 * también los formularios.
 */

export const MEDIOS_ABONO = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
] as const satisfies readonly MedioAbono[];

export const NOMBRE_MEDIO_ABONO: Record<MedioAbono, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

export const MEDIOS_PAGO_PROVEEDOR = [
  "EFECTIVO_CAJA",
  "EFECTIVO_FUERA_CAJA",
  "TRANSFERENCIA",
] as const satisfies readonly MedioPagoProveedor[];

export const NOMBRE_MEDIO_PAGO_PROVEEDOR: Record<MedioPagoProveedor, string> = {
  EFECTIVO_CAJA: "Efectivo de caja",
  EFECTIVO_FUERA_CAJA: "Efectivo fuera de caja",
  TRANSFERENCIA: "Transferencia",
};

export const MAXIMO_NOTA_CUENTA = 250;

export type CodigoErrorCuenta =
  | "SIN_PERMISO"
  | "SUCURSAL_REQUERIDA"
  | "MONTO_INVALIDO"
  | "MEDIO_NO_PERMITIDO"
  | "SIN_SALDO"
  | "SUPERA_SALDO"
  | "NOTA_INVALIDA"
  | "CLIENTE_NO_ENCONTRADO"
  | "PROVEEDOR_NO_ENCONTRADO";

/** Error de negocio con código estable y, si corresponde, el campo del formulario. */
export class ErrorCuenta extends Error {
  constructor(
    readonly codigo: CodigoErrorCuenta,
    mensaje: string,
    readonly campo?: string,
  ) {
    super(mensaje);
    this.name = "ErrorCuenta";
  }
}

/** Una fila del estado de cuenta, con el saldo que quedó después de ella. */
export type FilaEstadoCuenta = {
  id: number;
  fecha: Date;
  tipo: "CARGO" | "ABONO" | "PAGO" | "ANULACION";
  /** Venta o compra que originó el cargo o su anulación. */
  origenId: number | null;
  /** Medio del abono o pago, ya como texto. */
  medio: string | null;
  usuario: string | null;
  nota: string | null;
  /** Positivo suma a la deuda; negativo la baja. */
  importe: string;
  saldo: string;
};
