import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EncabezadoPagina, EstadoVacio, Volver } from "@/components/ui/pagina";
import { SelectorSucursal } from "@/components/ui/selector-sucursal";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { aDecimal, textoMonto } from "@/lib/calculos";
import { estadoCaja, filtroGastosPendientes, totalesPendientes } from "@/lib/cierres/calcular";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";
import { sucursalDePantalla } from "@/lib/sucursal";

import { FormularioCierre, type ResumenPrevio } from "../_components/formulario-cierre";

export const metadata: Metadata = { title: "Cerrar caja | Inversiones Ferrera" };

export default async function CerrarCajaPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  const encabezado = (
    <>
      <Volver href="/cierres">Cierres de caja</Volver>
      <EncabezadoPagina
        titulo="Cerrar caja"
        descripcion="Contá el efectivo del cajón. El sistema lo compara con lo que debería haber según las ventas desde el cierre anterior."
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

  const parametros = await leerParametros(searchParams);
  const contexto = await sucursalDePantalla(usuario, parametros.sucursal);
  if (!contexto) {
    return (
      <section>
        {encabezado}
        <EstadoVacio icono="tienda" titulo="No hay sucursales cargadas" />
      </section>
    );
  }
  const { sucursal, opciones } = contexto;

  const estado = await estadoCaja(prisma, sucursal.id);
  const fondo = estado.cierreAnterior?.fondoSiguiente ?? null;
  const [totales, cantidadGastos] = await Promise.all([
    totalesPendientes(prisma, sucursal.id, estado.inicioCadena, fondo ?? aDecimal(0)),
    prisma.gasto.count({
      where: { ...filtroGastosPendientes(sucursal.id, estado.inicioCadena), anulado: false },
    }),
  ]);

  // El empleado cuenta a ciegas: el efectivo esperado no viaja a su pantalla
  // hasta que termina de contar (lo pide la vista previa).
  const resumen: ResumenPrevio = {
    cantidadVentas: totales.cantidadVentas,
    ventasTransferencia: totales.ventasTransferencia,
    ventasTarjeta: totales.ventasTarjeta,
    ventasFiado: totales.ventasFiado,
    efectivo: esAdmin
      ? {
          ventasEfectivo: totales.ventasEfectivo,
          devolucionesEfectivo: totales.devolucionesEfectivo,
        }
      : null,
    gastosCaja: { total: totales.gastosCaja, cantidad: cantidadGastos },
  };

  return (
    <section>
      <Volver href="/cierres">Cierres de caja</Volver>
      <EncabezadoPagina
        titulo="Cerrar caja"
        descripcion="Contá el efectivo del cajón. El sistema lo compara con lo que debería haber según las ventas desde el cierre anterior."
        acciones={
          opciones.length > 0 ? <SelectorSucursal opciones={opciones} actual={sucursal.id} /> : null
        }
      />
      <FormularioCierre
        key={sucursal.id}
        sucursal={sucursal}
        enviarSucursal={usuario.sucursalId === null}
        cierreAnterior={
          estado.cierreAnterior
            ? {
                id: estado.cierreAnterior.id,
                fecha: estado.cierreAnterior.fecha.toISOString(),
                fondoSiguiente: textoMonto(estado.cierreAnterior.fondoSiguiente),
              }
            : null
        }
        desde={estado.desde.toISOString()}
        resumen={resumen}
      />
    </section>
  );
}
