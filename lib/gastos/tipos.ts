import type { CategoriaGasto, MedioPagoGasto } from "@prisma/client";

/*
 * Contrato entre las pantallas de gastos y sus server actions. No importa nada
 * de servidor: lo usan también los formularios.
 */

export const CATEGORIAS_GASTO = [
  "OPERATIVO",
  "MERCADERIA",
  "ADMINISTRATIVO",
] as const satisfies readonly CategoriaGasto[];

export const NOMBRE_CATEGORIA: Record<CategoriaGasto, string> = {
  OPERATIVO: "Operativo",
  MERCADERIA: "Mercadería",
  ADMINISTRATIVO: "Administrativo",
};

export const MEDIOS_GASTO = [
  "EFECTIVO_CAJA",
  "EFECTIVO_FUERA_CAJA",
  "TRANSFERENCIA",
  "TARJETA",
] as const satisfies readonly MedioPagoGasto[];

export const NOMBRE_MEDIO: Record<MedioPagoGasto, string> = {
  EFECTIVO_CAJA: "Efectivo de caja",
  EFECTIVO_FUERA_CAJA: "Efectivo fuera de caja",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

export const MINIMO_DESCRIPCION = 3;
export const MAXIMO_DESCRIPCION = 250;
export const MAXIMO_COMPROBANTE = 60;
export const MAXIMO_NOMBRE_CONCEPTO = 60;
export const MINIMO_MOTIVO_ANULACION = 5;
export const MAXIMO_MOTIVO_ANULACION = 500;
/** Un gasto fijo se paga entre el 1 y el 28: así existe en todos los meses. */
export const DIA_MAXIMO_GASTO_FIJO = 28;

export type CodigoErrorGasto =
  | "SIN_PERMISO"
  | "SUCURSAL_REQUERIDA"
  | "CONCEPTO_INACTIVO"
  | "MONTO_INVALIDO"
  | "FECHA_INVALIDA"
  | "MEDIO_NO_PERMITIDO"
  | "DESCRIPCION_REQUERIDA"
  | "MOTIVO_INVALIDO"
  | "GASTO_NO_ENCONTRADO"
  | "YA_ANULADO"
  | "CONCEPTO_DUPLICADO"
  | "GASTO_FIJO_INVALIDO"
  | "DIA_DEL_MES_INVALIDO";

/** Error de negocio con código estable y, si corresponde, el campo del formulario. */
export class ErrorGasto extends Error {
  constructor(
    readonly codigo: CodigoErrorGasto,
    mensaje: string,
    readonly campo?: string,
  ) {
    super(mensaje);
    this.name = "ErrorGasto";
  }
}

/** Qué cambió al anular, para explicarlo en pantalla (sección 3.7). */
export type EfectoAnulacion =
  | { tipo: "CAJA_PENDIENTE" }
  | { tipo: "CAJA_CERRADA"; cierreId: number }
  | { tipo: "OTRO_MEDIO" };

export type ResultadoAnulacionGasto =
  | { ok: true; efecto: EfectoAnulacion }
  | { ok: false; codigo: CodigoErrorGasto; mensaje: string };

/** Estado de un gasto fijo en un mes (sección 6.3). */
export type EstadoGastoFijo = "REGISTRADO" | "PENDIENTE" | "ATRASADO";

export const NOMBRE_ESTADO_FIJO: Record<EstadoGastoFijo, string> = {
  REGISTRADO: "Registrado",
  PENDIENTE: "Pendiente",
  ATRASADO: "Atrasado",
};
