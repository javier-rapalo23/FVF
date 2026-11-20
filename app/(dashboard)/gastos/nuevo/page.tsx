import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EncabezadoPagina, EstadoVacio, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { estadoCaja, totalesPendientes } from "@/lib/cierres/calcular";
import { DIAS_ATRAS_COMPRA } from "@/lib/config";
import { diaDelNegocio, sumarDias } from "@/lib/fecha";
import { prisma } from "@/lib/prisma";

import { FormularioGasto } from "../_components/formulario-gasto";

export const metadata: Metadata = { title: "Nuevo gasto | Inversiones Ferrera" };

export default async function NuevoGastoPage() {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  const encabezado = (
    <>
      <Volver href="/gastos">Gastos</Volver>
      <EncabezadoPagina
        titulo={esAdmin ? "Nuevo gasto" : "Gasto de caja"}
        descripcion={
          esAdmin
            ? "Lo que se pagó y no es mercadería que entra al stock: servicios, salarios, fletes, bolsas."
            : "Algo que pagaste con el efectivo de la caja: un flete, hielo, bolsas."
        }
      />
    </>
  );

  if (!esAdmin && usuario.sucursalId === null) {
    return (
      <section>
        {encabezado}
        <EstadoVacio icono="tienda" titulo="Sin sucursal asignada">
          Tu usuario no tiene una sucursal. Pedile al administrador que te asigne una.
        </EstadoVacio>
      </section>
    );
  }

  const [conceptos, sucursales] = await Promise.all([
    prisma.conceptoGasto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, categoria: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } }),
  ]);
  const sucursalPropia = sucursales.find((s) => s.id === usuario.sucursalId) ?? null;

  // Efectivo que debería haber ahora en cada caja, para el aviso del
  // administrador. Nunca se calcula para el empleado (conteo a ciegas).
  let esperados: Record<number, string> | null = null;
  if (esAdmin) {
    const cajas = sucursalPropia ? [sucursalPropia] : sucursales;
    const valores = await Promise.all(
      cajas.map(async (s) => {
        const estado = await estadoCaja(prisma, s.id);
        // Sin un cierre anterior no se conoce el fondo inicial: no se avisa.
        if (!estado.cierreAnterior) return null;
        const totales = await totalesPendientes(
          prisma,
          s.id,
          estado.inicioCadena,
          estado.cierreAnterior.fondoSiguiente,
        );
        return [s.id, totales.esperado] as const;
      }),
    );
    esperados = Object.fromEntries(valores.filter((v) => v !== null));
  }

  const hoy = diaDelNegocio();

  return (
    <section>
      {encabezado}
      {conceptos.length === 0 ? (
        <EstadoVacio icono="gastos" titulo="No hay conceptos activos">
          {esAdmin
            ? "Activá o creá un concepto en la pestaña Conceptos para poder registrar gastos."
            : "Pedile al administrador que active los conceptos de gasto."}
        </EstadoVacio>
      ) : (
        <FormularioGasto
          // La clave nace con la página: un doble envío del mismo formulario no duplica el gasto.
          claveIdempotencia={randomUUID()}
          conceptos={conceptos}
          esAdmin={esAdmin}
          sucursalPropia={sucursalPropia}
          sucursales={esAdmin ? sucursales : []}
          esperados={esperados}
          hoy={hoy}
          diaMinimo={sumarDias(hoy, -DIAS_ATRAS_COMPRA)}
        />
      )}
    </section>
  );
}
