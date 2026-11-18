"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { CLASES_SELECT_SUELTO } from "@/components/ui/campo";

/** Solo para el administrador sin sucursal asignada y con más de una cargada. */
export function SelectorSucursal({
  opciones,
  actual,
}: {
  opciones: readonly { id: number; nombre: string }[];
  actual: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-[13px] text-tinta-media">
      Sucursal
      <select
        value={actual}
        disabled={pendiente}
        onChange={(evento) => {
          const valor = evento.target.value;
          // Cambiar de sucursal descarta búsqueda y filtros: son de la anterior.
          startTransition(() => router.push(`${pathname}?sucursal=${valor}`));
        }}
        className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
      >
        {opciones.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
