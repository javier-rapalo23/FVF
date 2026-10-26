"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { CLASES_INPUT } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { formatoMoneda } from "@/lib/formato";
import type { ClienteCatalogo } from "@/lib/ventas/tipos";

import { normalizarTexto } from "./carrito";

const MAXIMO_RESULTADOS = 8;

/** Opción "Sin cliente" dentro de la lista (id `null`). */
type Opcion = ClienteCatalogo | null;

/**
 * Cliente de la venta, con búsqueda por nombre. Elegido, muestra lo que el
 * cajero necesita para cobrar: tipo (define el precio), saldo y fiado.
 */
export function SelectorCliente({
  clientes,
  cliente,
  clienteNoDisponible,
  permitirSinCliente,
  onCambio,
}: {
  clientes: readonly ClienteCatalogo[];
  cliente: ClienteCatalogo | null;
  /** El carrito apunta a un cliente que ya no está activo. */
  clienteNoDisponible: boolean;
  permitirSinCliente: boolean;
  onCambio: (clienteId: number | null) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const indexados = useMemo(
    () => clientes.map((c) => ({ cliente: c, nombre: normalizarTexto(c.nombre) })),
    [clientes],
  );

  const termino = normalizarTexto(texto);
  const opciones: Opcion[] = [
    ...(permitirSinCliente && !termino ? [null] : []),
    ...indexados
      .filter((item) => !termino || item.nombre.includes(termino))
      .slice(0, MAXIMO_RESULTADOS)
      .map((item) => item.cliente),
  ];

  function abrir() {
    setBuscando(true);
    setTexto("");
    setIndice(0);
    requestAnimationFrame(() => campo.current?.focus());
  }

  function elegir(opcion: Opcion) {
    setBuscando(false);
    setTexto("");
    onCambio(opcion?.id ?? null);
  }

  function alPresionar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (opciones.length === 0) return;
      const paso = evento.key === "ArrowDown" ? 1 : -1;
      setIndice((actual) => (actual + paso + opciones.length) % opciones.length);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const opcion = opciones[indice];
      if (opcion !== undefined) elegir(opcion);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      setBuscando(false);
    }
  }

  if (buscando || (!cliente && !clienteNoDisponible)) {
    return (
      <div className="relative">
        <input
          ref={campo}
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setIndice(0);
          }}
          onFocus={() => setBuscando(true)}
          onBlur={() => setBuscando(false)}
          onKeyDown={alPresionar}
          placeholder={permitirSinCliente ? "Sin cliente · buscar por nombre" : "Buscar cliente por nombre"}
          aria-label="Cliente"
          role="combobox"
          aria-expanded={buscando}
          aria-controls="opciones-cliente"
          autoComplete="off"
          className={`h-10 ${CLASES_INPUT}`}
        />

        {buscando ? (
          <ul
            id="opciones-cliente"
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-72 overflow-y-auto rounded-lg border border-borde bg-superficie shadow-elevado"
          >
            {opciones.length === 0 ? (
              <li className="px-3.5 py-3 text-[13px] text-tinta-media">
                Ningún cliente coincide.
              </li>
            ) : (
              opciones.map((opcion, i) => (
                <li key={opcion?.id ?? "sin-cliente"} role="option" aria-selected={i === indice}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => elegir(opcion)}
                    onMouseEnter={() => setIndice(i)}
                    className={[
                      "flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px]",
                      i === indice ? "bg-marca-50" : "",
                    ].join(" ")}
                  >
                    {opcion ? (
                      <>
                        <span className="truncate font-medium text-tinta">{opcion.nombre}</span>
                        <span className="shrink-0 text-[11px] text-tinta-suave">
                          {opcion.tipo === "MAYORISTA" ? "Mayorista" : "Minorista"}
                        </span>
                      </>
                    ) : (
                      <span className="text-tinta-media">Sin cliente (consumidor final)</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-peligro-fondo px-3.5 py-3 text-[13px] text-peligro-tinta">
        <span>El cliente elegido ya no está disponible.</span>
        <button type="button" onClick={abrir} className="font-medium underline underline-offset-2">
          Cambiar
        </button>
      </div>
    );
  }

  const saldo = Number(cliente.saldo);

  return (
    <div className="rounded-lg border border-borde bg-superficie-suave px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-tinta">{cliente.nombre}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Etiqueta tono={cliente.tipo === "MAYORISTA" ? "info" : "neutro"}>
              {cliente.tipo === "MAYORISTA" ? "Mayorista" : "Minorista"}
            </Etiqueta>
            <Etiqueta tono={cliente.fiadoHabilitado ? "exito" : "neutro"}>
              {cliente.fiadoHabilitado ? "Fiado habilitado" : "Sin fiado"}
            </Etiqueta>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={abrir}
            className="rounded-md px-2 py-1 text-[12px] text-tinta-media transition-colors duration-150 hover:bg-superficie hover:text-tinta"
          >
            Cambiar
          </button>
          {permitirSinCliente ? (
            <button
              type="button"
              onClick={() => onCambio(null)}
              title="Quitar cliente"
              className="flex h-7 w-7 items-center justify-center rounded-md text-tinta-suave transition-colors duration-150 hover:bg-superficie hover:text-tinta"
            >
              <Icono nombre="cerrar" tamano={15} />
              <span className="sr-only">Quitar cliente</span>
            </button>
          ) : null}
        </div>
      </div>

      <dl className="cifras mt-3 grid grid-cols-2 gap-2 border-t border-borde pt-2.5 text-[12px]">
        <div>
          <dt className="text-tinta-suave">Saldo</dt>
          <dd className={saldo > 0 ? "font-medium text-alerta-tinta" : "text-tinta"}>
            {formatoMoneda(cliente.saldo)}
          </dd>
        </div>
        <div>
          <dt className="text-tinta-suave">Límite</dt>
          <dd className="text-tinta">
            {!cliente.fiadoHabilitado
              ? "—"
              : cliente.limiteCredito === null
                ? "Sin tope"
                : formatoMoneda(cliente.limiteCredito)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
