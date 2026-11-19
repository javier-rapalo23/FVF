import type { DENOMINACIONES } from "@/lib/config";

/*
 * Contrato entre la pantalla de cierre y sus server actions. No importa nada
 * de servidor: lo usa también el formulario. Los montos viajan como strings.
 */

export type Denominacion = (typeof DENOMINACIONES)[number];

/** Cantidad de billetes o monedas por denominación. */
export type DetalleConteo = Partial<Record<Denominacion, number>>;

export type PayloadVistaPrevia = {
  sucursalId: number | null;
  /** El cierre anterior que vio la pantalla, para detectar uno simultáneo. */
  cierreAnteriorId: number | null;
  /** Solo en el primer cierre de la sucursal. */
  fondoInicial: string | null;
};

export type PayloadCierre = PayloadVistaPrevia & {
  claveIdempotencia: string;
  /** Si viene `detalleConteo`, el servidor lo recalcula desde ahí. */
  totalContado: string;
  detalleConteo: DetalleConteo | null;
  fondoSiguiente: string;
  notas: string | null;
};

/** Importes del cierre, ya calculados por el servidor. */
export type TotalesCierre = {
  fondoInicial: string;
  ventasEfectivo: string;
  devolucionesEfectivo: string;
  ventasTransferencia: string;
  ventasTarjeta: string;
  ventasFiado: string;
  cantidadVentas: number;
  /** fondoInicial + ventasEfectivo − devolucionesEfectivo. */
  esperado: string;
};

export type CodigoErrorCierre =
  | "PAYLOAD_INVALIDO"
  | "SIN_PERMISO"
  | "SUCURSAL_REQUERIDA"
  | "MONTO_INVALIDO"
  | "FONDO_INVALIDO"
  | "NOTA_REQUERIDA"
  | "CIERRE_DESACTUALIZADO"
  | "CIERRE_NO_ENCONTRADO"
  | "YA_REVISADO";

export type ErrorCierreSerializado = { ok: false; codigo: CodigoErrorCierre; mensaje: string };

export type ResultadoVistaPrevia = { ok: true; totales: TotalesCierre } | ErrorCierreSerializado;

export type ResultadoCierre =
  | {
      ok: true;
      cierreId: number;
      /** La clave ya estaba registrada: es el mismo cierre, no uno nuevo. */
      yaRegistrado: boolean;
      totales: TotalesCierre;
      totalContado: string;
      diferencia: string;
      fondoSiguiente: string;
      retiro: string;
    }
  | ErrorCierreSerializado;

export type ResultadoRevision = { ok: true } | ErrorCierreSerializado;

/** Error de negocio con código estable. Las acciones lo devuelven serializado. */
export class ErrorCierre extends Error {
  constructor(
    readonly codigo: CodigoErrorCierre,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorCierre";
  }

  serializar(): ErrorCierreSerializado {
    return { ok: false, codigo: this.codigo, mensaje: this.message };
  }
}
