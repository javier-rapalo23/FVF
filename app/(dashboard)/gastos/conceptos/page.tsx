import type { Metadata } from "next";

import { EncabezadoPagina, Pestanas } from "@/components/ui/pagina";
import { Tabla } from "@/components/ui/tabla";
import { CATEGORIAS_GASTO } from "@/lib/gastos/tipos";
import { prisma } from "@/lib/prisma";

import { PESTANAS_GASTOS } from "../_components/pestanas";
import { FilaConcepto, NuevoConcepto } from "./_components/conceptos";

export const metadata: Metadata = { title: "Conceptos de gasto | Inversiones Ferrera" };

/** Solo administrador: la ruta tiene su propio permiso en `lib/permissions.ts`. */
export default async function ConceptosGastoPage() {
  const conceptos = await prisma.conceptoGasto.findMany({
    select: { id: true, nombre: true, categoria: true, activo: true, _count: { select: { gastos: true } } },
    orderBy: { nombre: "asc" },
  });
  const ordenados = CATEGORIAS_GASTO.flatMap((c) => conceptos.filter((x) => x.categoria === c));

  return (
    <section className="max-w-3xl">
      <EncabezadoPagina
        titulo="Gastos"
        descripcion="Cada gasto se registra con un concepto, y el concepto define su categoría. Un concepto con gastos no se borra: se desactiva y deja de ofrecerse."
      />

      <Pestanas items={PESTANAS_GASTOS} activa="/gastos/conceptos" />

      <NuevoConcepto />

      <Tabla
        columnas={[
          { label: "Concepto" },
          { label: "Categoría" },
          { label: "Gastos", derecha: true },
          { label: "Acciones", derecha: true },
        ]}
      >
        {ordenados.map((concepto) => (
          <FilaConcepto
            key={concepto.id}
            id={concepto.id}
            nombre={concepto.nombre}
            categoria={concepto.categoria}
            activo={concepto.activo}
            gastos={concepto._count.gastos}
          />
        ))}
      </Tabla>
    </section>
  );
}
