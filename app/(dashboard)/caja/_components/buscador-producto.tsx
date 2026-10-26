"use client";

import type { TipoCliente } from "@prisma/client";
import { useMemo, useState, type KeyboardEvent, type Ref } from "react";

import { CLASES_INPUT } from "@/components/ui/campo";
import { Tecla } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { cantidad, formatoMoneda } from "@/lib/formato";
import { precioSegunCliente } from "@/lib/ventas/precios";
import type { ProductoCatalogo } from "@/lib/ventas/tipos";

import { normalizarTexto } from "./carrito";

const MAXIMO_RESULTADOS = 8;

/**
 * Campo único de búsqueda y escaneo.
 *
 * Los lectores de código de barras se comportan como un teclado: escriben el
 * código y mandan Enter. Al presionar Enter se busca, en orden: código de
 * barras exacto, ID interno exacto y, si no, el resultado resaltado de la
 * lista por nombre (que se filtra al tipear, sobre el catálogo en memoria).
 */
export function BuscadorProducto({
  ref,
  productos,
  tipoCliente,
  deshabilitado,
  onElegir,
}: {
  ref: Ref<HTMLInputElement>;
  productos: readonly ProductoCatalogo[];
  tipoCliente: TipoCliente | null;
  deshabilitado: boolean;
  onElegir: (producto: ProductoCatalogo) => void;
}) {
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const indexados = useMemo(
    () => productos.map((producto) => ({ producto, nombre: normalizarTexto(producto.nombre) })),
    [productos],
  );

  const termino = normalizarTexto(texto);
  const resultados = useMemo(
    () =>
      termino
        ? indexados
            .filter((item) => item.nombre.includes(termino))
            .slice(0, MAXIMO_RESULTADOS)
            .map((item) => item.producto)
        : [],
    [indexados, termino],
  );

  function elegir(producto: ProductoCatalogo) {
    setTexto("");
    setIndice(0);
    setAviso(null);
    onElegir(producto);
  }

  function alPresionar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      if (resultados.length === 0) return;
      evento.preventDefault();
      const paso = evento.key === "ArrowDown" ? 1 : -1;
      setIndice((actual) => (actual + paso + resultados.length) % resultados.length);
      return;
    }

    if (evento.key === "Escape" && texto) {
      // Que el Esc limpie la búsqueda y no cierre nada más.
      evento.stopPropagation();
      setTexto("");
      setIndice(0);
      return;
    }

    if (evento.key !== "Enter") return;
    // Enter nunca envía ni cobra: solo resuelve la búsqueda.
    evento.preventDefault();

    const codigo = texto.trim();
    if (!codigo) return;

    const porCodigo =
      productos.find((p) => p.codigoBarras === codigo) ??
      (/^\d+$/.test(codigo)
        ? productos.find((p) => p.idInterno === Number(codigo))
        : undefined);

    const elegido = porCodigo ?? resultados[indice] ?? resultados[0];
    if (elegido) {
      elegir(elegido);
      return;
    }

    setTexto("");
    setIndice(0);
    setAviso(
      /^\d+$/.test(codigo)
        ? `El código ${codigo} no está registrado.`
        : `Ningún producto coincide con "${codigo}".`,
    );
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave">
        <Icono nombre="buscar" tamano={17} />
      </span>
      <input
        ref={ref}
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setIndice(0);
          setAviso(null);
        }}
        onKeyDown={alPresionar}
        disabled={deshabilitado}
        placeholder="Escaneá o buscá por nombre o ID"
        aria-label="Buscar producto"
        aria-expanded={resultados.length > 0}
        aria-controls="resultados-producto"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        className={`h-12 pl-10 pr-14 text-[15px] ${CLASES_INPUT}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <Tecla>F2</Tecla>
      </span>

      {aviso ? (
        <p
          role="alert"
          className="mt-2 flex items-center gap-2 rounded-md bg-peligro-fondo px-3 py-2 text-[13px] text-peligro-tinta"
        >
          <Icono nombre="alerta" tamano={15} />
          {aviso} No se agregó nada.
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul
          id="resultados-producto"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-borde bg-superficie shadow-elevado"
        >
          {resultados.map((producto, i) => (
            <li key={producto.id} role="option" aria-selected={i === indice}>
              <button
                type="button"
                tabIndex={-1}
                // `mousedown` + preventDefault: el foco se queda en la búsqueda.
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => elegir(producto)}
                onMouseEnter={() => setIndice(i)}
                className={[
                  "flex w-full items-center gap-3 px-3.5 py-2.5 text-left",
                  i === indice ? "bg-marca-50" : "",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-tinta">
                    {producto.nombre}
                  </span>
                  <span className="cifras mt-0.5 block text-[12px] text-tinta-suave">
                    {producto.idInterno} · {producto.categoria.nombre} ·{" "}
                    {cantidad(producto.stock, producto.unidadVenta)} en stock
                  </span>
                </span>
                <span className="cifras shrink-0 text-[14px] font-medium text-tinta">
                  {formatoMoneda(precioSegunCliente(producto, tipoCliente))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
