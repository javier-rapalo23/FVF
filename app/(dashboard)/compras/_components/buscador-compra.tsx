"use client";

import { useMemo, useState, type KeyboardEvent, type Ref } from "react";

import { CLASES_INPUT } from "@/components/ui/campo";
import { Icono } from "@/components/ui/icono";
import type { ProductoCompra } from "@/lib/compras/tipos";
import { formatoMoneda } from "@/lib/formato";
import { normalizarTexto } from "@/lib/texto";

const MAXIMO_RESULTADOS = 8;

/**
 * Búsqueda y escaneo de productos para la compra. Igual que en caja, Enter
 * resuelve en orden: código de barras exacto, ID interno exacto y, si no, el
 * resultado resaltado. Los productos del proveedor elegido aparecen primero.
 */
export function BuscadorCompra({
  ref,
  productos,
  proveedorId,
  onElegir,
}: {
  ref: Ref<HTMLInputElement>;
  productos: readonly ProductoCompra[];
  proveedorId: number | null;
  onElegir: (producto: ProductoCompra) => void;
}) {
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const indexados = useMemo(
    () =>
      [...productos]
        // `sort` es estable: dentro de cada grupo se conserva el orden alfabético.
        .sort(
          (a, b) =>
            Number(b.proveedorId === proveedorId) - Number(a.proveedorId === proveedorId),
        )
        .map((producto) => ({ producto, nombre: normalizarTexto(producto.nombre) })),
    [productos, proveedorId],
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

  function elegir(producto: ProductoCompra) {
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
      evento.stopPropagation();
      setTexto("");
      setIndice(0);
      return;
    }

    if (evento.key !== "Enter") return;
    evento.preventDefault();

    const codigo = texto.trim();
    if (!codigo) return;

    const porCodigo =
      productos.find((p) => p.codigoBarras === codigo) ??
      (/^\d+$/.test(codigo) ? productos.find((p) => p.idInterno === Number(codigo)) : undefined);

    const elegido = porCodigo ?? resultados[indice] ?? resultados[0];
    if (elegido) {
      elegir(elegido);
      return;
    }

    setTexto("");
    setIndice(0);
    setAviso(
      /^\d+$/.test(codigo)
        ? `El código ${codigo} no está registrado (o el producto está inactivo).`
        : `Ningún producto activo coincide con "${codigo}".`,
    );
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave">
        <Icono nombre="buscar" tamano={16} />
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
        placeholder="Agregar producto: escaneá o buscá por nombre o ID"
        aria-label="Agregar producto"
        aria-expanded={resultados.length > 0}
        aria-controls="resultados-compra"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        className={`h-10 pl-9 ${CLASES_INPUT}`}
      />

      {aviso ? (
        <p
          role="alert"
          className="mt-2 flex items-center gap-2 rounded-md bg-peligro-fondo px-3 py-2 text-[13px] text-peligro-tinta"
        >
          <Icono nombre="alerta" tamano={15} />
          {aviso}
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul
          id="resultados-compra"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-borde bg-superficie shadow-elevado"
        >
          {resultados.map((producto, i) => (
            <li key={producto.id} role="option" aria-selected={i === indice}>
              <button
                type="button"
                tabIndex={-1}
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
                    {producto.idInterno} · {producto.categoria}
                    {proveedorId !== null && producto.proveedorId === proveedorId
                      ? " · de este proveedor"
                      : ""}
                  </span>
                </span>
                <span className="cifras shrink-0 text-right text-[12px] text-tinta-media">
                  {producto.costoActual === null
                    ? "Sin compras"
                    : `Último costo ${formatoMoneda(producto.costoActual)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
