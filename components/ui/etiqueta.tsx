import type { ReactNode } from "react";

type Tono = "neutro" | "exito" | "alerta" | "peligro" | "info";

const TONOS: Record<Tono, string> = {
  neutro: "bg-superficie-suave text-tinta-media border-borde",
  exito: "bg-exito-fondo text-exito-tinta border-transparent",
  alerta: "bg-alerta-fondo text-alerta-tinta border-transparent",
  peligro: "bg-peligro-fondo text-peligro-tinta border-transparent",
  info: "bg-info-fondo text-info-tinta border-transparent",
};

/** Badge de estado. Pastilla solo acá: nunca en contenedores ni botones. */
export function Etiqueta({
  tono = "neutro",
  children,
  className = "",
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-[0.06em]",
        TONOS[tono],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** Tecla física para los atajos. La caja se opera con teclado, no con mouse. */
export function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd
      className={[
        "inline-flex h-5 min-w-5 items-center justify-center rounded border",
        "border-borde bg-superficie-suave px-1.5",
        "font-mono text-[11px] font-medium text-tinta-media",
      ].join(" ")}
    >
      {children}
    </kbd>
  );
}
