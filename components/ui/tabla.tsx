import type { ReactNode, TdHTMLAttributes } from "react";

type Columna = {
  label: string;
  /** Cifras y acciones se alinean a la derecha. */
  derecha?: boolean;
  /** Columna que se oculta en pantallas angostas. */
  ocultaMovil?: boolean;
};

/**
 * Tabla de listados de gestión. Densa y sin cebra: el divisor de 1px alcanza
 * para seguir la fila, y el hover marca la que se está por editar.
 */
export function Tabla({
  columnas,
  children,
}: {
  columnas: readonly Columna[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-borde bg-superficie">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-borde bg-superficie-suave">
            {columnas.map((columna) => (
              <th
                key={columna.label}
                scope="col"
                className={[
                  "whitespace-nowrap px-4 py-2.5",
                  "text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave",
                  columna.derecha ? "text-right" : "",
                  columna.ocultaMovil ? "hidden md:table-cell" : "",
                ].join(" ")}
              >
                {columna.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">{children}</tbody>
      </table>
    </div>
  );
}

export function Fila({
  children,
  atenuada = false,
}: {
  children: ReactNode;
  /** Registros inactivos: siguen visibles pero pasan a segundo plano. */
  atenuada?: boolean;
}) {
  return (
    <tr
      className={[
        "transition-colors duration-150 hover:bg-superficie-suave",
        atenuada ? "text-tinta-suave" : "text-tinta",
      ].join(" ")}
    >
      {children}
    </tr>
  );
}

export function Celda({
  derecha = false,
  ocultaMovil = false,
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  derecha?: boolean;
  ocultaMovil?: boolean;
}) {
  return (
    <td
      className={[
        "px-4 py-2.5 align-middle",
        derecha ? "text-right" : "",
        ocultaMovil ? "hidden md:table-cell" : "",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
