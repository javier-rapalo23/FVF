import type { ReactNode } from "react";

import { Icono, type NombreIcono } from "./icono";

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  meta,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-tinta">
            {titulo}
          </h1>
          {meta}
        </div>
        {descripcion ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-tinta-media">
            {descripcion}
          </p>
        ) : null}
      </div>
      {acciones ? (
        <div className="flex shrink-0 items-center gap-2">{acciones}</div>
      ) : null}
    </header>
  );
}

export function Tarjeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-borde bg-superficie ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Estado vacío de un módulo todavía no implementado.
 *
 * Enumera lo que el módulo va a resolver en lugar de decir solo "pendiente":
 * el sistema se entrega por partes y esto le dice al dueño del local qué falta.
 */
export function ModuloPendiente({
  icono,
  alcance,
}: {
  icono: NombreIcono;
  alcance: readonly string[];
}) {
  return (
    <Tarjeta className="max-w-2xl px-6 py-10">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-borde bg-superficie-suave text-tinta-suave">
          <Icono nombre={icono} tamano={20} />
        </span>

        <p className="text-sm font-medium text-tinta">
          Módulo pendiente de implementar
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-tinta-media">
          La navegación y los permisos ya funcionan. Esto es lo que va a
          resolver esta pantalla:
        </p>

        <ul className="mt-5 space-y-2 text-left">
          {alcance.map((punto) => (
            <li
              key={punto}
              className="flex items-start gap-2.5 text-[13px] leading-relaxed text-tinta-media"
            >
              <span className="mt-0.5 shrink-0 text-marca-500">
                <Icono nombre="check" tamano={14} />
              </span>
              {punto}
            </li>
          ))}
        </ul>
      </div>
    </Tarjeta>
  );
}
