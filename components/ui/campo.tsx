import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
} from "react";

export const CLASES_INPUT = [
  "w-full rounded-md border border-borde bg-superficie",
  "px-3 text-sm text-tinta placeholder:text-tinta-suave",
  "transition-colors duration-150",
  "hover:border-borde-fuerte",
  "focus:border-marca-500 focus:outline-none focus:ring-[3px] focus:ring-marca-100",
  "disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-tinta-suave",
  "aria-[invalid=true]:border-peligro-tinta/40 aria-[invalid=true]:focus:ring-peligro-fondo",
].join(" ");

/** `select` nativo con el chevron del set de iconos (ver `.select-nativo` en globals.css). */
const CLASES_SELECT = "select-nativo pr-9";

type Contexto = {
  etiqueta: string;
  /** Nota bajo el campo. */
  ayuda?: ReactNode;
  /** Mensaje de validación. Reemplaza a la ayuda mientras exista. */
  error?: string;
};

/**
 * Rótulo + control + nota. Lo usan `Campo` y `CampoSelect`, y también los
 * controles a medida (segmentados, selectores con alta al vuelo).
 */
export function GrupoCampo({
  etiqueta,
  ayuda,
  error,
  htmlFor,
  children,
}: Contexto & { htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-tinta-media"
      >
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-peligro-tinta">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-tinta-suave">{ayuda}</p>
      ) : null}
    </div>
  );
}

type Props = InputHTMLAttributes<HTMLInputElement> &
  Contexto & {
    /** En React 19 `ref` es una prop más y llega al `input` con el resto. */
    ref?: Ref<HTMLInputElement>;
  };

export function Campo({
  etiqueta,
  ayuda,
  error,
  id,
  className = "",
  ...props
}: Props) {
  return (
    <GrupoCampo etiqueta={etiqueta} ayuda={ayuda} error={error} htmlFor={id}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className={`h-10 ${CLASES_INPUT} ${className}`}
        {...props}
      />
    </GrupoCampo>
  );
}

type PropsSelect = SelectHTMLAttributes<HTMLSelectElement> & Contexto;

export function CampoSelect({
  etiqueta,
  ayuda,
  error,
  id,
  className = "",
  children,
  ...props
}: PropsSelect) {
  return (
    <GrupoCampo etiqueta={etiqueta} ayuda={ayuda} error={error} htmlFor={id}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className={`h-10 ${CLASES_INPUT} ${CLASES_SELECT} ${className}`}
        {...props}
      >
        {children}
      </select>
    </GrupoCampo>
  );
}

/** Select suelto (filtros de listado), con el mismo chevron que `CampoSelect`. */
export const CLASES_SELECT_SUELTO = `${CLASES_INPUT} ${CLASES_SELECT}`;
