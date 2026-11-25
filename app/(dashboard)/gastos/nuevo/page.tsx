import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { EncabezadoPagina, EstadoVacio, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { estadoCaja, totalesPendientes } from "@/lib/cierres/calcular";
import { DIAS_ATRAS_COMPRA } from "@/lib/config";
import { diaDelNegocio, diasDelMes, sumarDias } from "@/lib/fecha";
import { filtroDelPeriodo } from "@/lib/gastos/resumen";
import { validarDiaGasto } from "@/lib/gastos/registrar";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { FormularioGasto, type PlantillaFijo } from "../_components/formulario-gasto";

export const metadata: Metadata = { title: "Nuevo gasto | Inversiones Ferrera" };

export default async function NuevoGastoPage({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";
  const parametros = await leerParametros(searchParams);
  const hoy = diaDelNegocio();

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

  // Registrar desde un gasto fijo (Etapa 2, solo administrador): la plantilla
  // carga concepto, descripción, medio, sucursal y el monto estimado.
  const fijoId = esAdmin && /^\d{1,9}$/.test(parametros.fijo ?? "") ? Number(parametros.fijo) : null;
  const fijo = fijoId
    ? await prisma.gastoFijo.findUnique({
        where: { id: fijoId },
        include: { concepto: { select: { id: true, nombre: true, categoria: true, activo: true } } },
      })
    : null;
  if (fijoId && (!fijo?.activo || !fijo.concepto.activo)) {
    return (
      <section>
        {encabezado}
        <EstadoVacio
          icono="gastos"
          titulo={fijo ? "No se puede registrar este gasto fijo" : "El gasto fijo no existe"}
          accion={
            <Link href={fijo ? `/gastos/fijos/${fijo.id}` : "/gastos/fijos"} className={clasesBoton("secundario")}>
              {fijo ? "Revisar el gasto fijo" : "Ver gastos fijos"}
            </Link>
          }
        >
          {!fijo
            ? "Puede que se haya borrado el enlace. Elegilo de nuevo desde Gastos fijos."
            : !fijo.activo
              ? "Está desactivado. Activalo para registrarlo."
              : `Su concepto «${fijo.concepto.nombre}» está desactivado. Activalo en Conceptos o cambiá el concepto del gasto fijo.`}
        </EstadoVacio>
      </section>
    );
  }
  // Día propuesto (un mes pasado desde el resumen); si no entra en el límite, hoy.
  const diaInicial =
    fijo && parametros.dia && validarDiaGasto(parametros.dia, hoy) === null ? parametros.dia : hoy;
  let plantilla: PlantillaFijo | null = null;
  if (fijo) {
    // Aviso si ya se registró en el mes del día propuesto: no se bloquea (puede pagarse en partes).
    const yaRegistrados = await prisma.gasto.count({
      where: { ...filtroDelPeriodo(diasDelMes(diaInicial.slice(0, 7))), gastoFijoId: fijo.id },
    });
    plantilla = {
      id: fijo.id,
      descripcion: fijo.descripcion,
      conceptoId: fijo.conceptoId,
      montoEstimado: fijo.montoEstimado.toFixed(2),
      medioPago: fijo.medioPago,
      sucursalId: fijo.sucursalId,
      diaDelMes: fijo.diaDelMes,
      yaRegistrados,
    };
  }

  const [conceptos, sucursales] = await Promise.all([
    prisma.conceptoGasto.findMany({
      // Desde un fijo solo se ofrece su concepto: el gasto lo marca como registrado.
      where: fijo ? { id: fijo.conceptoId } : { activo: true },
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
          diaInicial={diaInicial}
          fijo={plantilla}
          diaMinimo={sumarDias(hoy, -DIAS_ATRAS_COMPRA)}
        />
      )}
    </section>
  );
}
