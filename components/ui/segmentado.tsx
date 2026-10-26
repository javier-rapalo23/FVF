"use client";

/**
 * Control segmentado para alternar entre pocas opciones excluyentes
 * (canal de venta, lista de precios, unidad de venta). Se prefiere a un
 * `select` porque el estado queda visible sin abrir nada: en caja no hay
 * tiempo de inspeccionar.
 *
 * Con `name`, además envía el valor elegido dentro de un `<form>`.
 */
export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambio,
  etiqueta,
  name,
  id,
}: {
  valor: T;
  opciones: readonly { valor: T; label: string }[];
  onCambio: (valor: T) => void;
  etiqueta: string;
  name?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={etiqueta}
      className="flex w-fit shrink-0 items-center gap-0.5 rounded-md border border-borde bg-superficie-suave p-0.5"
    >
      {name ? <input type="hidden" name={name} value={valor} /> : null}

      {opciones.map((opcion) => {
        const activo = opcion.valor === valor;

        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(opcion.valor)}
            className={[
              "rounded-[4px] px-2.5 py-1 text-[12px] transition-colors duration-150",
              activo
                ? "bg-superficie font-medium text-tinta shadow-sutil"
                : "text-tinta-media hover:text-tinta",
            ].join(" ")}
          >
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}
