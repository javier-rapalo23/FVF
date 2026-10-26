"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Diálogo modal sobre `<dialog>` nativo: el navegador resuelve el foco
 * atrapado, el fondo inerte y `Esc` (que acá llama a `onCerrar`).
 *
 * Al abrir enfoca el primer elemento con `data-autofocus`; el `autoFocus` de
 * React no sirve porque corre cuando el diálogo todavía está cerrado.
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = "md",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;

    if (abierto && !dialogo.open) {
      dialogo.showModal();
      dialogo.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!abierto && dialogo.open) {
      dialogo.close();
    }
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-label={titulo}
      onCancel={(evento) => {
        // `Esc`: el estado lo maneja el padre, no el navegador.
        evento.preventDefault();
        onCerrar();
      }}
      className={[
        "m-auto w-[calc(100vw-2rem)] rounded-xl border border-borde bg-superficie p-0 text-tinta shadow-elevado",
        "backdrop:bg-[rgba(31,30,28,0.35)]",
        ancho === "lg" ? "max-w-lg" : "max-w-md",
      ].join(" ")}
    >
      {abierto ? (
        <div className="px-5 py-5">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tinta">{titulo}</h2>
          <div className="mt-3">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
