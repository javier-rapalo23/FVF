import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { formatoRtn } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { guardarProveedor } from "../../actions";
import { FormularioProveedor } from "../../_components/formulario-proveedor";

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

  const ficha = `/proveedores/${proveedor.id}`;

  return (
    <section>
      <Volver href={ficha}>{proveedor.nombre}</Volver>
      <EncabezadoPagina titulo="Editar proveedor" />

      <FormularioProveedor
        accion={guardarProveedor.bind(null, proveedor.id)}
        esNuevo={false}
        volverA={ficha}
        inicial={{
          nombre: proveedor.nombre,
          telefono: proveedor.telefono ?? "",
          rtn: proveedor.rtn ? formatoRtn(proveedor.rtn) : "",
          correo: proveedor.correo ?? "",
          direccion: proveedor.direccion ?? "",
          observaciones: proveedor.observaciones ?? "",
          activo: proveedor.activo,
        }}
      />
    </section>
  );
}
