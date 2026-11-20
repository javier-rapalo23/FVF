import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { aNumero, formatoRtn } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { guardarCliente } from "../../actions";
import { FormularioCliente } from "../../_components/formulario-cliente";

export const metadata: Metadata = {
  title: "Editar cliente | Inversiones Ferrera",
};

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const ficha = `/clientes/${cliente.id}`;

  return (
    <section>
      <Volver href={ficha}>{cliente.nombre}</Volver>
      <EncabezadoPagina titulo="Editar cliente" />

      <FormularioCliente
        accion={guardarCliente.bind(null, cliente.id)}
        esNuevo={false}
        volverA={ficha}
        inicial={{
          nombre: cliente.nombre,
          telefono: cliente.telefono ?? "",
          rtn: cliente.rtn ? formatoRtn(cliente.rtn) : "",
          correo: cliente.correo ?? "",
          direccion: cliente.direccion ?? "",
          observaciones: cliente.observaciones ?? "",
          tipo: cliente.tipo,
          fiadoHabilitado: cliente.fiadoHabilitado,
          limiteCredito:
            cliente.limiteCredito === null
              ? ""
              : String(aNumero(cliente.limiteCredito.toString())),
          activo: cliente.activo,
        }}
      />
    </section>
  );
}
