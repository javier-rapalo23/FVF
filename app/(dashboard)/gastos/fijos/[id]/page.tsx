import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { aNumero } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { guardarGastoFijoAccion } from "../../actions";
import { FormularioGastoFijo } from "../_components/formulario-gasto-fijo";
import { opcionesGastoFijo } from "../_components/opciones";

export const metadata: Metadata = { title: "Editar gasto fijo | Inversiones Ferrera" };

/** Solo administrador: la ruta tiene su propio permiso en `lib/permissions.ts`. */
export default async function EditarGastoFijoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fijoId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!fijoId) notFound();

  const fijo = await prisma.gastoFijo.findUnique({ where: { id: fijoId } });
  if (!fijo) notFound();
  const [conceptos, sucursales] = await opcionesGastoFijo(fijo.conceptoId);

  return (
    <section>
      <Volver href="/gastos/fijos">Gastos fijos</Volver>
      <EncabezadoPagina
        titulo={fijo.descripcion}
        descripcion="Los cambios valen para los meses que vienen. Los gastos ya registrados desde este fijo no cambian."
        meta={fijo.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
      />
      <FormularioGastoFijo
        accion={guardarGastoFijoAccion.bind(null, fijo.id)}
        esNuevo={false}
        conceptos={conceptos}
        sucursales={sucursales}
        inicial={{
          conceptoId: fijo.conceptoId,
          descripcion: fijo.descripcion,
          // Sin ceros de relleno: "12000" en vez de "12000.00" en el input.
          montoEstimado: String(aNumero(fijo.montoEstimado.toString())),
          diaDelMes: String(fijo.diaDelMes),
          medioPago: fijo.medioPago,
          sucursalId: fijo.sucursalId,
          activo: fijo.activo,
        }}
      />
    </section>
  );
}
