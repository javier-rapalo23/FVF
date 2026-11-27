import { NOMBRE_NEGOCIO } from "@/lib/config";
import { formatoFechaHora } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";

export type DatosComprobanteAbono = {
  id: number;
  fecha: Date;
  /** Caja que lo recibió; nula en un abono por transferencia sin sucursal. */
  sucursal: string | null;
  cajero: string;
  cliente: string;
  medio: string;
  monto: string;
  /** Lo que quedó debiendo después de este abono. */
  saldoPendiente: string;
  nota: string | null;
  anulado: boolean;
};

/** Comprobante interno de un abono, para papel de 80 mm, igual que el de venta. */
export function ComprobanteAbono({ abono }: { abono: DatosComprobanteAbono }) {
  return (
    <article className="relative w-full max-w-[80mm] overflow-hidden rounded-lg border border-borde bg-white px-5 py-5 font-mono text-[12px] leading-snug text-black print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="text-center">
        <p className="text-[14px] font-bold uppercase">{NOMBRE_NEGOCIO}</p>
        {abono.sucursal ? <p>{abono.sucursal}</p> : null}
        <p className="mt-1 font-bold">ABONO A CUENTA</p>
        {abono.anulado ? <p className="mt-1 text-[14px] font-bold">*** ANULADO ***</p> : null}
      </header>

      <div className="my-3 border-t border-dashed border-black" />

      <dl className="space-y-0.5">
        <Dato etiqueta="Abono N°" valor={String(abono.id).padStart(6, "0")} />
        <Dato etiqueta="Fecha" valor={formatoFechaHora(abono.fecha)} />
        <Dato etiqueta="Recibió" valor={abono.cajero} />
        <Dato etiqueta="Cliente" valor={abono.cliente} />
      </dl>
      {abono.nota ? <p className="mt-1 whitespace-pre-line">Nota: {abono.nota}</p> : null}

      <div className="my-3 border-t border-dashed border-black" />

      <p className="flex justify-between text-[15px] font-bold">
        <span>ABONO</span>
        <span>{formatoMoneda(abono.monto)}</span>
      </p>
      <p className="mt-1 flex justify-between">
        <span>Pago</span>
        <span>{abono.medio}</span>
      </p>
      <p className="mt-1 flex justify-between">
        <span>Saldo pendiente</span>
        <span>{formatoMoneda(abono.saldoPendiente)}</span>
      </p>

      <div className="my-3 border-t border-dashed border-black" />

      <p className="text-center text-[11px]">Comprobante interno, no válido como factura</p>
    </article>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{etiqueta}</dt>
      <dd className="text-right">{valor}</dd>
    </div>
  );
}
