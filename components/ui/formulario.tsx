"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  type FormEvent,
  type ReactNode,
} from "react";

import type { EstadoFormulario } from "@/lib/formulario";

import { Boton, clasesBoton } from "./boton";
import { Icono } from "./icono";

/**
 * `useActionState` con envío manual.
 *
 * Con `<form action={…}>`, React 19 resetea los campos no controlados al
 * terminar la acción, incluso cuando vuelve con errores de validación: el
 * administrador perdería todo lo que tipeó. Despachando desde `onSubmit` el
 * formulario conserva lo escrito y solo se muestran los errores.
 */
export function useFormulario(
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>,
  inicial: EstadoFormulario,
) {
  const [estado, despachar, pendiente] = useActionState(accion, inicial);

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(() => despachar(datos));
  }

  return [estado, alEnviar, pendiente] as const;
}

export function AlertaFormulario({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md bg-peligro-fondo px-3 py-2.5 text-[13px] leading-snug text-peligro-tinta"
    >
      <span className="mt-px shrink-0">
        <Icono nombre="alerta" tamano={15} />
      </span>
      {mensaje}
    </p>
  );
}

/** Bloque de campos con rótulo de sección, dentro de la tarjeta del formulario. */
export function SeccionFormulario({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <section
      role="group"
      aria-label={titulo}
      className="grid gap-x-5 gap-y-4 border-t border-borde px-5 py-5 first:border-t-0 md:grid-cols-[200px_1fr]"
    >
      <div className="md:pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
          {titulo}
        </p>
        {descripcion ? (
          <p className="mt-1 text-[12px] leading-relaxed text-tinta-media">
            {descripcion}
          </p>
        ) : null}
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PieFormulario({
  volverA,
  pendiente,
  textoEnviar,
}: {
  volverA: string;
  pendiente: boolean;
  textoEnviar: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-borde bg-superficie-suave px-5 py-3.5">
      <Link href={volverA} className={clasesBoton("fantasma")}>
        Cancelar
      </Link>
      <Boton type="submit" variante="primario" disabled={pendiente}>
        {pendiente ? "Guardando…" : textoEnviar}
      </Boton>
    </div>
  );
}
