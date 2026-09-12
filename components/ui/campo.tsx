import type { InputHTMLAttributes, ReactNode } from "react";

export const CLASES_INPUT = [
  "w-full rounded-md border border-borde bg-superficie",
  "px-3 text-sm text-tinta placeholder:text-tinta-suave",
  "transition-colors duration-150",
  "hover:border-borde-fuerte",
  "focus:border-marca-500 focus:outline-none focus:ring-[3px] focus:ring-marca-100",
  "disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-tinta-suave",
].join(" ");

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  /** Nota bajo el campo: ayuda o mensaje de error. */
  ayuda?: ReactNode;
};

export function Campo({
  etiqueta,
  ayuda,
  id,
  className = "",
  ...props
}: Props) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-tinta-media"
      >
        {etiqueta}
      </label>
      <input id={id} className={`h-10 ${CLASES_INPUT} ${className}`} {...props} />
      {ayuda ? <p className="text-xs text-tinta-suave">{ayuda}</p> : null}
    </div>
  );
}
