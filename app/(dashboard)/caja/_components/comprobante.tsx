import type { Canal, MetodoPago, UnidadVenta } from "@prisma/client";

import { NOMBRE_NEGOCIO } from "@/lib/config";
import { formatoFechaHora } from "@/lib/fecha";
import { cantidad, formatoMoneda } from "@/lib/formato";

import { NOMBRE_METODO } from "./opciones";

export type DatosComprobante = {
  /** `null` mientras la venta espera sincronizarse: el número lo asigna el servidor. */
  id: number | null;
  fecha: Date;
  sucursal: string;
  cajero: string;
  cliente: string | null;
  canal: Canal;
  notas: string | null;
  metodoPago: MetodoPago;
  total: string;
  anulada: boolean;
  lineas: {
    id: number;
    producto: string;
    unidadVenta: UnidadVenta;
    cantidad: string;
    precioUnitario: string;
    subtotal: string;
  }[];
};

/**
 * Comprobante interno, pensado para papel de 80 mm. En pantalla se ve como un
 * ticket; al imprimir, el resto de la página se oculta (`.no-imprimir`).
 */
export function Comprobante({ venta }: { venta: DatosComprobante }) {
  return (
    <article className="relative w-full max-w-[80mm] overflow-hidden rounded-lg border border-borde bg-white px-5 py-5 font-mono text-[12px] leading-snug text-black print:max-w-none print:rounded-none print:border-0 print:p-0">
      {venta.anulada ? (
        <p className="mb-3 border-2 border-black py-1 text-center text-[14px] font-bold tracking-[0.2em]">
          ANULADA
        </p>
      ) : null}

      {venta.id === null ? (
        <p className="mb-3 border-2 border-dashed border-black py-1 text-center text-[12px] font-bold">
          PENDIENTE DE SINCRONIZAR
        </p>
      ) : null}

      <header className="text-center">
        <p className="text-[14px] font-bold uppercase">{NOMBRE_NEGOCIO}</p>
        <p>{venta.sucursal}</p>
      </header>

      <div className="my-3 border-t border-dashed border-black" />

      <dl className="space-y-0.5">
        <Dato
          etiqueta="Venta N°"
          valor={venta.id === null ? "pendiente" : String(venta.id).padStart(6, "0")}
        />
        <Dato etiqueta="Fecha" valor={formatoFechaHora(venta.fecha)} />
        <Dato etiqueta="Cajero" valor={venta.cajero} />
        <Dato etiqueta="Cliente" valor={venta.cliente ?? "Consumidor final"} />
        {venta.canal === "PEDIDO" ? <Dato etiqueta="Canal" valor="Pedido" /> : null}
      </dl>
      {venta.notas ? <p className="mt-1 whitespace-pre-line">Notas: {venta.notas}</p> : null}

      <div className="my-3 border-t border-dashed border-black" />

      <ul className="space-y-1.5">
        {venta.lineas.map((linea) => (
          <li key={linea.id}>
            <p className="break-words">{linea.producto}</p>
            <p className="flex justify-between gap-2">
              <span>
                {cantidad(linea.cantidad, linea.unidadVenta)} x{" "}
                {formatoMoneda(linea.precioUnitario)}
              </span>
              <span>{formatoMoneda(linea.subtotal)}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-dashed border-black" />

      <p className="flex justify-between text-[15px] font-bold">
        <span>TOTAL</span>
        <span>{formatoMoneda(venta.total)}</span>
      </p>
      <p className="mt-1 flex justify-between">
        <span>Pago</span>
        <span>{NOMBRE_METODO[venta.metodoPago]}</span>
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
