import Link from "next/link";
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

/** Listado sin resultados, o módulo todavía sin datos cargados. */
export function EstadoVacio({
  icono,
  titulo,
  children,
  accion,
}: {
  icono: NombreIcono;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <Tarjeta className="px-6 py-12">
      <div className="mx-auto max-w-sm text-center">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-borde bg-superficie-suave text-tinta-suave">
          <Icono nombre={icono} tamano={18} />
        </span>
        <p className="text-[13px] font-medium text-tinta">{titulo}</p>
        {children ? (
          <p className="mt-1 text-[12px] leading-relaxed text-tinta-media">
            {children}
          </p>
        ) : null}
        {accion ? <div className="mt-4 flex justify-center">{accion}</div> : null}
      </div>
    </Tarjeta>
  );
}

/** Confirmación tras guardar, que llega por `?guardado=` después del redirect. */
export function AvisoGuardado({ nombre }: { nombre?: string }) {
  if (!nombre) return null;

  return (
    <p
      role="status"
      className="mb-4 flex items-center gap-2 rounded-lg bg-exito-fondo px-3.5 py-2.5 text-[13px] text-exito-tinta"
    >
      <Icono nombre="check" tamano={15} />
      <span>
        <span className="font-medium">{nombre}</span> se guardó correctamente.
      </span>
    </p>
  );
}

/** Sub-navegación entre pantallas de un mismo módulo (ej. Productos / Categorías). */
export function Pestanas({
  items,
  activa,
}: {
  items: readonly { href: string; label: string }[];
  activa: string;
}) {
  return (
    <nav className="mb-5 flex gap-5 border-b border-borde">
      {items.map((item) => {
        const esActiva = item.href === activa;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={esActiva ? "page" : undefined}
            className={[
              "-mb-px border-b py-2 text-[13px] transition-colors duration-150",
              esActiva
                ? "border-tinta font-medium text-tinta"
                : "border-transparent text-tinta-media hover:text-tinta",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Enlace "volver" sobre el título de las pantallas de alta y edición. */
export function Volver({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-[12px] text-tinta-media transition-colors duration-150 hover:text-tinta"
    >
      <span className="rotate-90">
        <Icono nombre="chevron" tamano={14} />
      </span>
      {children}
    </Link>
  );
}
