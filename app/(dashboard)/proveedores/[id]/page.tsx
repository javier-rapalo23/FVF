import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { prisma } from "@/lib/prisma";

import { guardarProveedor } from "../actions";
import { FormularioProveedor } from "../_components/formulario-proveedor";

export const metadata: Metadata = {
  title: "Editar proveedor | Inversiones Ferrera",
};

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) notFound();

  return (
    <section>
      <Volver href="/proveedores">Proveedores</Volver>
      <EncabezadoPagina
        titulo={proveedor.nombre}
        meta={proveedor.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
      />

      <FormularioProveedor
        accion={guardarProveedor.bind(null, proveedor.id)}
        esNuevo={false}
        inicial={{
          nombre: proveedor.nombre,
          telefono: proveedor.telefono ?? "",
          activo: proveedor.activo,
        }}
      />
    </section>
  );
}
