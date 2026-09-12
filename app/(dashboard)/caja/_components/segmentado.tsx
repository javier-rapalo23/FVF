"use client";

/**
 * Control segmentado para alternar entre pocas opciones excluyentes
 * (canal de venta, lista de precios). Se prefiere a un `select` porque el
 * estado queda visible sin abrir nada: en caja no hay tiempo de inspeccionar.
 */
export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambio,
  etiqueta,
}: {
  valor: T;
  opciones: readonly { valor: T; label: string }[];
  onCambio: (valor: T) => void;
  etiqueta: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-borde bg-superficie-suave p-0.5"
    >
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
