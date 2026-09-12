import { Icono } from "./icono";

/**
 * Marca del sistema. El único lugar donde el logotipo se define; el resto de
 * la interfaz lo consume, nunca lo redibuja.
 */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-carbon text-marca-300">
        <Icono nombre="tienda" tamano={16} />
      </span>

      {compacta ? null : (
        <span className="leading-none">
          <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-tinta-suave">
            Inversiones
          </span>
          <span className="mt-1 block text-[15px] font-semibold tracking-[-0.01em] text-tinta">
            Ferrera
          </span>
        </span>
      )}
    </span>
  );
}
