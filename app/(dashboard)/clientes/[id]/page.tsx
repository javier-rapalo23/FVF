import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { aNumero } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { guardarCliente } from "../actions";
import { FormularioCliente } from "../_components/formulario-cliente";

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

  return (
    <section>
      <Volver href="/clientes">Clientes</Volver>
      <EncabezadoPagina
        titulo={cliente.nombre}
        meta={cliente.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
      />

      <FormularioCliente
        accion={guardarCliente.bind(null, cliente.id)}
        esNuevo={false}
        inicial={{
          nombre: cliente.nombre,
          telefono: cliente.telefono ?? "",
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
