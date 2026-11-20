import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import { corregirGastoAccion } from "../../actions";
import { CorregirGasto } from "../../_components/corregir-gasto";

export const metadata: Metadata = { title: "Editar gasto | Inversiones Ferrera" };

export default async function EditarGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gastoId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!gastoId) notFound();

  // `/gastos` es de ambos roles; la corrección es solo del administrador.
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  if (usuario.rol !== "ADMINISTRADOR") redirect(`/gastos/${gastoId}`);

  const gasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    select: { id: true, conceptoId: true, descripcion: true, numeroComprobante: true, anulado: true },
  });
  if (!gasto) notFound();
  if (gasto.anulado) redirect(`/gastos/${gasto.id}`);

  // Los activos, más el actual aunque se haya desactivado después.
  const conceptos = await prisma.conceptoGasto.findMany({
    where: { OR: [{ activo: true }, { id: gasto.conceptoId }] },
    select: { id: true, nombre: true, categoria: true },
    orderBy: { nombre: "asc" },
  });

  const ficha = `/gastos/${gasto.id}`;

  return (
    <section>
      <Volver href={ficha}>Gasto N° {gasto.id}</Volver>
      <EncabezadoPagina titulo="Editar gasto" />
      <CorregirGasto
        accion={corregirGastoAccion.bind(null, gasto.id)}
        conceptos={conceptos}
        volverA={ficha}
        inicial={{
          conceptoId: gasto.conceptoId,
          descripcion: gasto.descripcion,
          numeroComprobante: gasto.numeroComprobante ?? "",
        }}
      />
    </section>
  );
}
