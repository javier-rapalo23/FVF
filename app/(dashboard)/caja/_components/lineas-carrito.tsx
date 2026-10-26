"use client";

import { useEffect, useRef } from "react";

import { Etiqueta, Tecla } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { cantidad as fmtCantidad, formatoMoneda, sufijoUnidad } from "@/lib/formato";

import type { FilaCarrito } from "./carrito";

const COLUMNAS = "md:grid-cols-[minmax(0,1fr)_150px_100px_110px_32px]";

/**
 * Líneas de la venta. La cantidad se edita en el lugar; Enter la confirma y
 * devuelve el foco a la búsqueda. Stock insuficiente y vencimiento se marcan,
 * pero no bloquean: el producto ya está en el mostrador.
 */
export function LineasCarrito({
  filas,
  focoEn,
  onFocoAplicado,
  onCantidad,
  onConfirmar,
  onQuitar,
}: {
  filas: readonly FilaCarrito[];
  /** `uid` de la línea cuyo campo de cantidad debe tomar el foco (peso recién agregado). */
  focoEn: string | null;
  onFocoAplicado: () => void;
  onCantidad: (uid: string, texto: string) => void;
  onConfirmar: (uid: string) => void;
  onQuitar: (uid: string) => void;
}) {
  const campos = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focoEn) return;
    const campo = campos.current.get(focoEn);
    if (campo) {
      campo.focus();
      campo.select();
      onFocoAplicado();
    }
  }, [focoEn, filas, onFocoAplicado]);

  if (filas.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-borde-fuerte bg-superficie px-6 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-borde bg-superficie-suave text-tinta-suave">
          <Icono nombre="caja" tamano={18} />
        </span>
        <p className="text-[13px] font-medium text-tinta">Carrito vacío</p>
        <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-tinta-media">
          Escaneá un producto o buscalo por nombre. <Tecla>F2</Tecla> vuelve a la
          búsqueda desde cualquier lugar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
      <div
        className={`hidden gap-3 border-b border-borde bg-superficie-suave px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave md:grid ${COLUMNAS}`}
      >
        <span>Producto</span>
        <span>Cantidad</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Subtotal</span>
        <span className="sr-only">Quitar</span>
      </div>

      <ul className="divide-y divide-borde">
        {filas.map((fila) => {
          const { linea, producto } = fila;
          const nombre = producto?.nombre ?? "Producto no disponible";
          const invalida = fila.cantidad !== null && !fila.cantidad.valida;
          const idError = `error-${linea.uid}`;

          return (
            <li
              key={linea.uid}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 ${COLUMNAS}`}
            >
              {/* Producto */}
              <div className="col-span-2 min-w-0 md:col-span-1">
                <p className="truncate text-[14px] font-medium text-tinta">{nombre}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {producto ? (
                    <span className="cifras text-[11px] text-tinta-suave">
                      ID {producto.idInterno} · stock{" "}
                      {fmtCantidad(producto.stock, producto.unidadVenta)}
                    </span>
                  ) : (
                    <Etiqueta tono="peligro">Quitalo para cobrar</Etiqueta>
                  )}
                  {fila.superaStock ? <Etiqueta tono="peligro">Supera el stock</Etiqueta> : null}
                  {fila.vencido ? <Etiqueta tono="alerta">Vencido</Etiqueta> : null}
                </div>
              </div>

              {/* Cantidad */}
              <div>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={(campo) => {
                      if (campo) campos.current.set(linea.uid, campo);
                      else campos.current.delete(linea.uid);
                    }}
                    value={linea.cantidad}
                    onChange={(evento) => onCantidad(linea.uid, evento.target.value)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter" || evento.key === "Escape") {
                        evento.preventDefault();
                        evento.stopPropagation();
                        if (evento.key === "Escape" || !invalida) onConfirmar(linea.uid);
                      }
                    }}
                    disabled={!producto}
                    inputMode={producto?.unidadVenta === "PESO" ? "decimal" : "numeric"}
                    placeholder={producto?.unidadVenta === "PESO" ? "0.000" : "1"}
                    aria-label={`Cantidad de ${nombre}`}
                    aria-invalid={invalida || fila.superaStock ? true : undefined}
                    aria-describedby={invalida ? idError : undefined}
                    autoComplete="off"
                    className={[
                      "cifras h-9 w-24 rounded-md border bg-superficie px-2.5 text-right text-[14px] text-tinta",
                      "transition-colors duration-150 focus:outline-none focus:ring-[3px]",
                      invalida || fila.superaStock
                        ? "border-peligro-tinta/50 bg-peligro-fondo/40 focus:ring-peligro-fondo"
                        : "border-borde hover:border-borde-fuerte focus:border-marca-500 focus:ring-marca-100",
                    ].join(" ")}
                  />
                  {producto ? (
                    <span className="text-[12px] text-tinta-suave">
                      {sufijoUnidad(producto.unidadVenta)}
                    </span>
                  ) : null}
                </div>
                {invalida && fila.cantidad && !fila.cantidad.valida ? (
                  <p id={idError} className="mt-1 text-[11px] text-peligro-tinta">
                    {linea.cantidad.trim() ? fila.cantidad.mensaje : "Ingresá la cantidad."}
                  </p>
                ) : null}
              </div>

              {/* Precio y subtotal */}
              <div className="flex items-center justify-end gap-3 md:contents">
                <p className="cifras text-[12px] text-tinta-media md:text-right md:text-[13px]">
                  {fila.precioUnitario ? (
                    <>
                      {formatoMoneda(fila.precioUnitario)}
                      <span className="md:hidden">
                        {" "}
                        / {producto ? sufijoUnidad(producto.unidadVenta) : ""}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="cifras text-right text-[14px] font-medium text-tinta">
                  {fila.subtotal ? formatoMoneda(fila.subtotal) : "—"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onQuitar(linea.uid)}
                title={`Quitar ${nombre}`}
                className="hidden h-8 w-8 items-center justify-center justify-self-end rounded-md text-tinta-suave transition-colors duration-150 hover:bg-peligro-fondo hover:text-peligro-tinta md:flex"
              >
                <Icono nombre="basura" tamano={15} />
                <span className="sr-only">Quitar {nombre}</span>
              </button>

              {/* En celular el botón de quitar va en su propia fila, a la derecha. */}
              <button
                type="button"
                onClick={() => onQuitar(linea.uid)}
                className="col-span-2 justify-self-end text-[12px] text-tinta-suave transition-colors duration-150 hover:text-peligro-tinta md:hidden"
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
