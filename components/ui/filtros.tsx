"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "./campo";
import { Icono } from "./icono";

type Filtro = {
  nombre: string;
  etiqueta: string;
  opciones: readonly { valor: string; label: string }[];
};

/**
 * Búsqueda y filtros de un listado. El estado vive en la URL (`?q=…`), así
 * que el filtrado lo hace el servidor y un listado filtrado se puede recargar
 * o compartir tal cual.
 *
 * Los valores actuales llegan por props desde la página para no depender de
 * `useSearchParams`, que obligaría a envolver cada listado en `Suspense`.
 */
export function BarraFiltros({
  placeholder,
  valores,
  filtros = [],
}: {
  placeholder: string;
  valores: Readonly<Record<string, string>>;
  filtros?: readonly Filtro[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [consulta, setConsulta] = useState(valores.q ?? "");
  const [pendiente, startTransition] = useTransition();

  // La referencia evita que el efecto de la búsqueda se dispare cuando cambian
  // los filtros: solo debe reaccionar al texto.
  const actuales = useRef(valores);
  actuales.current = valores;

  function navegar(cambios: Record<string, string>) {
    const parametros = new URLSearchParams();
    for (const [clave, valor] of Object.entries({ ...actuales.current, ...cambios })) {
      // El aviso de "guardado" es de un solo uso: se descarta al filtrar.
      if (valor && clave !== "guardado") parametros.set(clave, valor);
    }
    const query = parametros.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  useEffect(() => {
    if (consulta.trim() === (actuales.current.q ?? "")) return;
    const espera = setTimeout(() => navegar({ q: consulta.trim() }), 250);
    return () => clearTimeout(espera);
    // `navegar` es estable a efectos prácticos: lee los valores por referencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave">
          <Icono nombre={pendiente ? "reloj" : "buscar"} tamano={16} />
        </span>
        <input
          type="search"
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`h-9 pl-9 ${CLASES_INPUT}`}
        />
      </div>

      {filtros.map((filtro) => (
        <label key={filtro.nombre} className="shrink-0">
          <span className="sr-only">{filtro.etiqueta}</span>
          <select
            value={valores[filtro.nombre] ?? ""}
            onChange={(evento) => navegar({ [filtro.nombre]: evento.target.value })}
            className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
          >
            {filtro.opciones.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
