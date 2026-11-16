import type { ButtonHTMLAttributes, Ref } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";
type Tamano = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  // El verde de marca aparece solo acá y en el estado activo de la navegación.
  primario:
    "bg-marca-600 text-white hover:bg-marca-700 active:scale-[0.99] disabled:hover:bg-marca-600",
  secundario:
    "bg-superficie text-tinta border border-borde hover:bg-superficie-suave hover:border-borde-fuerte active:scale-[0.99]",
  fantasma: "text-tinta-media hover:bg-superficie-suave hover:text-tinta",
  peligro: "bg-peligro-fondo text-peligro-tinta hover:bg-peligro-fondo-hover",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2.5",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  /** En React 19 `ref` es una prop más y llega al `button` con el resto. */
  ref?: Ref<HTMLButtonElement>;
};

/** Clases del botón, para dar el mismo aspecto a un `<Link>`. */
export function clasesBoton(
  variante: Variante = "secundario",
  tamano: Tamano = "md",
  className = "",
): string {
  return [
    "inline-flex items-center justify-center rounded-md font-medium",
    "transition-[background-color,border-color,transform] duration-150",
    "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
    VARIANTES[variante],
    TAMANOS[tamano],
    className,
  ].join(" ");
}

export function Boton({
  variante = "secundario",
  tamano = "md",
  className = "",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={clasesBoton(variante, tamano, className)}
      {...props}
    />
  );
}
