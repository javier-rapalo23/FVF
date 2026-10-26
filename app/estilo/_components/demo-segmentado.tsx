"use client";

import { useState } from "react";

import { Segmentado } from "@/components/ui/segmentado";

/** Envoltorio con estado para mostrar el control segmentado funcionando. */
export function DemoSegmentado() {
  const [valor, setValor] = useState<"MINORISTA" | "MAYORISTA">("MINORISTA");

  return (
    <div className="flex items-center gap-3">
      <Segmentado
        etiqueta="Lista de precios (demostración)"
        valor={valor}
        onCambio={setValor}
        opciones={[
          { valor: "MINORISTA", label: "Minorista" },
          { valor: "MAYORISTA", label: "Mayorista" },
        ]}
      />
      <span className="font-mono text-[11px] text-tinta-suave">{valor}</span>
    </div>
  );
}
