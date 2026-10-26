"use client";

import type { MetodoPago, Prisma, UnidadVenta } from "@prisma/client";

import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Icono } from "@/components/ui/icono";
import { cantidad, formatoMoneda } from "@/lib/formato";
import type { RespuestaVenta } from "@/lib/ventas/tipos";

import { NOMBRE_METODO } from "./opciones";

export type Resultado = {
  venta: RespuestaVenta;
  metodoPago: MetodoPago;
  clienteNombre: string | null;
  /** Solo en efectivo con monto recibido. No se guarda en la base. */
  vuelto: Prisma.Decimal | null;
  productos: ReadonlyMap<number, { nombre: string; unidadVenta: UnidadVenta }>;
};

/**
 * Confirmación de la venta registrada. "Nueva venta" queda enfocada: Enter
 * (o Esc) cierra y la caja vuelve a la búsqueda.
 */
export function ResultadoVenta({
  resultado,
  onNuevaVenta,
}: {
  resultado: Resultado | null;
  onNuevaVenta: () => void;
}) {
  return (
    <Dialogo abierto={resultado !== null} onCerrar={onNuevaVenta} titulo="Venta registrada">
      {resultado ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-exito-fondo px-4 py-3.5 text-exito-tinta">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-superficie">
              <Icono nombre="check" tamano={18} />
            </span>
            <div className="min-w-0">
              <p className="cifras text-[13px] font-medium">
                Venta N° {resultado.venta.ventaId} · {NOMBRE_METODO[resultado.metodoPago]}
                {resultado.clienteNombre ? ` · ${resultado.clienteNombre}` : ""}
              </p>
              <p className="cifras text-[26px] font-semibold leading-tight tracking-[-0.02em]">
                {formatoMoneda(resultado.venta.total)}
              </p>
            </div>
          </div>

          {resultado.venta.yaRegistrada ? (
            <p className="rounded-md bg-info-fondo px-3 py-2 text-[12px] text-info-tinta">
              Esta venta ya se había registrado en un intento anterior. No se duplicó.
            </p>
          ) : null}

          {resultado.vuelto ? (
            <div className="flex items-baseline justify-between rounded-lg border border-borde px-4 py-3">
              <span className="text-[13px] text-tinta-media">Vuelto</span>
              <span className="cifras text-[22px] font-semibold text-tinta">
                {formatoMoneda(resultado.vuelto)}
              </span>
            </div>
          ) : null}

          {resultado.venta.advertencias.length > 0 ? (
            <div className="rounded-lg bg-alerta-fondo px-3.5 py-3 text-[12px] text-alerta-tinta">
              <p className="flex items-center gap-1.5 font-medium">
                <Icono nombre="alerta" tamano={14} />
                Stock negativo
              </p>
              <ul className="cifras mt-1 space-y-0.5">
                {resultado.venta.advertencias.map((advertencia) => {
                  const producto = resultado.productos.get(advertencia.productoId);
                  return (
                    <li key={advertencia.productoId}>
                      {producto?.nombre ?? `Producto ${advertencia.productoId}`}: quedó en{" "}
                      {producto
                        ? cantidad(advertencia.stockResultante, producto.unidadVenta)
                        : advertencia.stockResultante}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-alerta-tinta/80">
                Se vendió igual. Avisá para que se revise el inventario.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <a
              href={`/caja/ventas/${resultado.venta.ventaId}?imprimir=1`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-borde px-3.5 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-superficie-suave"
            >
              <Icono nombre="imprimir" tamano={16} />
              Imprimir comprobante
            </a>
            <Boton variante="primario" className="h-10" onClick={onNuevaVenta} data-autofocus>
              Nueva venta
              <span className="font-mono text-[11px] opacity-70">Enter</span>
            </Boton>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}
