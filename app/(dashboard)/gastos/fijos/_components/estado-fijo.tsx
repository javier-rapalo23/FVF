import { Etiqueta } from "@/components/ui/etiqueta";
import { NOMBRE_ESTADO_FIJO, type EstadoGastoFijo } from "@/lib/gastos/tipos";

const TONO = { REGISTRADO: "exito", PENDIENTE: "neutro", ATRASADO: "alerta" } as const;

export function EtiquetaEstadoFijo({ estado }: { estado: EstadoGastoFijo }) {
  return <Etiqueta tono={TONO[estado]}>{NOMBRE_ESTADO_FIJO[estado]}</Etiqueta>;
}

/** Enlace para registrar el gasto del mes desde un fijo, con su plantilla cargada. */
export function enlaceRegistrarFijo(fijoId: number, dia?: string): string {
  return `/gastos/nuevo?fijo=${fijoId}${dia ? `&dia=${dia}` : ""}`;
}
