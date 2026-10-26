import type { Metadata } from "next";

import { EncabezadoPagina, EstadoVacio, Pestanas } from "@/components/ui/pagina";
import { Tabla } from "@/components/ui/tabla";
import { prisma } from "@/lib/prisma";

import { PESTANAS_PRODUCTOS } from "../_components/pestanas";
import { FilaCategoria, NuevaCategoria } from "./_components/categorias";

export const metadata: Metadata = {
  title: "Categorías | Inversiones Ferrera",
};

export default async function CategoriasPage() {
  const categorias = await prisma.categoria.findMany({
    select: { id: true, nombre: true, _count: { select: { productos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <section className="max-w-3xl">
      <EncabezadoPagina
        titulo="Productos"
        descripcion="Las categorías agrupan el catálogo en la caja y en los reportes. También se pueden crear al vuelo desde el formulario de producto."
      />

      <Pestanas items={PESTANAS_PRODUCTOS} activa="/productos/categorias" />

      <NuevaCategoria />

      {categorias.length === 0 ? (
        <EstadoVacio icono="productos" titulo="Todavía no hay categorías">
          Creá la primera con el campo de arriba.
        </EstadoVacio>
      ) : (
        <Tabla
          columnas={[
            { label: "Nombre" },
            { label: "Productos", derecha: true },
            { label: "Acciones", derecha: true },
          ]}
        >
          {categorias.map((categoria) => (
            <FilaCategoria
              key={categoria.id}
              id={categoria.id}
              nombre={categoria.nombre}
              productos={categoria._count.productos}
            />
          ))}
        </Tabla>
      )}
    </section>
  );
}
