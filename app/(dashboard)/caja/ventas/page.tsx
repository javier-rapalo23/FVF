import type { MetodoPago, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, EstadoVacio, Pestanas, Tarjeta } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { diaDelNegocio, esDiaValido, formatoDiaLargo, formatoHora, inicioYFinDelDia } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";
import { aDecimal, calcularTotal } from "@/lib/ventas/calculos";

import { PESTANAS_CAJA } from "../_components/pestanas";
import { NOMBRE_METODO } from "../_components/opciones";

export const metadata: Metadata = { title: "Ventas del día | Inversiones Ferrera" };

const METODOS: readonly MetodoPago[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "FIADO"];

export default async function VentasDelDiaPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  const esAdmin = usuario.rol === "ADMINISTRADOR";
  const parametros = await leerParametros(searchParams);
  const hoy = diaDelNegocio();

  // El empleado ve solo el día actual; el administrador puede elegir otro.
  const dia = esAdmin && parametros.fecha && esDiaValido(parametros.fecha) ? parametros.fecha : hoy;
  const { inicio, fin } = inicioYFinDelDia(dia);

  // Ventas de la sucursal del usuario. Un administrador sin sucursal fija ve
  // las de todas.
  if (!esAdmin && usuario.sucursalId === null) {
    return (
      <section>
        <Pestanas items={PESTANAS_CAJA} activa="/caja/ventas" />
        <EstadoVacio icono="tienda" titulo="Sin sucursal asignada">
          Tu usuario no tiene una sucursal. Pedile al administrador que te asigne una.
        </EstadoVacio>
      </section>
    );
  }

  const where: Prisma.VentaWhereInput = { fecha: { gte: inicio, lt: fin } };
  if (usuario.sucursalId !== null) where.sucursalId = usuario.sucursalId;

  const [ventas, cantidadSucursales] = await Promise.all([
    prisma.venta.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        canal: true,
        metodoPago: true,
        total: true,
        anulada: true,
        origenOffline: true,
        requiereRevision: true,
        cliente: { select: { nombre: true } },
        usuario: { select: { nombre: true } },
        sucursal: { select: { nombre: true } },
      },
      orderBy: { fecha: "desc" },
    }),
    usuario.sucursalId === null ? prisma.sucursal.count() : Promise.resolve(1),
  ]);

  const vigentes = ventas.filter((venta) => !venta.anulada);
  const totalDia = calcularTotal(vigentes.map((venta) => venta.total));
  const porMetodo = METODOS.map((metodo) => ({
    metodo,
    total: calcularTotal(
      vigentes.filter((venta) => venta.metodoPago === metodo).map((venta) => venta.total),
    ),
  })).filter((item) => item.total.gt(0));

  const mostrarSucursal = cantidadSucursales > 1;

  return (
    <section>
      <Pestanas items={PESTANAS_CAJA} activa="/caja/ventas" />

      <EncabezadoPagina
        titulo={dia === hoy ? "Ventas de hoy" : "Ventas del día"}
        descripcion={`${formatoDiaLargo(dia)}. Las anuladas se muestran pero no suman.`}
        acciones={
          esAdmin ? (
            <form method="get" className="flex items-center gap-2">
              <input
                type="date"
                name="fecha"
                defaultValue={dia}
                max={hoy}
                aria-label="Fecha"
                className={`h-9 w-auto ${CLASES_INPUT}`}
              />
              <Boton type="submit">Ver</Boton>
              {dia !== hoy ? (
                <Link href="/caja/ventas" className={clasesBoton("fantasma")}>
                  Hoy
                </Link>
              ) : null}
            </form>
          ) : null
        }
      />

      <Tarjeta className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
            Total vendido
          </p>
          <p className="cifras text-[24px] font-semibold tracking-[-0.02em] text-tinta">
            {formatoMoneda(totalDia)}
          </p>
        </div>
        <div className="cifras text-[13px] text-tinta-media">
          {vigentes.length} {vigentes.length === 1 ? "venta" : "ventas"}
          {ventas.length > vigentes.length
            ? ` · ${ventas.length - vigentes.length} anulada${ventas.length - vigentes.length === 1 ? "" : "s"}`
            : ""}
        </div>
        {porMetodo.map((item) => (
          <div key={item.metodo} className="cifras text-[13px]">
            <span className="text-tinta-suave">{NOMBRE_METODO[item.metodo]} </span>
            <span className="text-tinta">{formatoMoneda(item.total)}</span>
          </div>
        ))}
      </Tarjeta>

      {ventas.length === 0 ? (
        <EstadoVacio icono="caja" titulo="Sin ventas">
          {dia === hoy ? "Todavía no se registró ninguna venta hoy." : "No hubo ventas ese día."}
        </EstadoVacio>
      ) : (
        <Tabla
          columnas={[
            { label: "N°" },
            { label: "Hora" },
            { label: "Cliente" },
            { label: "Pago" },
            ...(mostrarSucursal ? [{ label: "Sucursal", ocultaMovil: true }] : []),
            { label: "Usuario", ocultaMovil: true },
            { label: "Estado" },
            { label: "Total", derecha: true },
          ]}
        >
          {ventas.map((venta) => (
            <Fila key={venta.id} atenuada={venta.anulada}>
              <Celda className="cifras font-mono">
                <Link
                  href={`/caja/ventas/${venta.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {venta.id}
                </Link>
              </Celda>
              <Celda className="cifras whitespace-nowrap text-tinta-media">
                {formatoHora(venta.fecha)}
              </Celda>
              <Celda>
                {venta.cliente?.nombre ?? <span className="text-tinta-suave">Sin cliente</span>}
                {venta.canal === "PEDIDO" ? (
                  <Etiqueta tono="info" className="ml-2">
                    Pedido
                  </Etiqueta>
                ) : null}
              </Celda>
              <Celda>{NOMBRE_METODO[venta.metodoPago]}</Celda>
              {mostrarSucursal ? (
                <Celda ocultaMovil className="text-tinta-media">
                  {venta.sucursal.nombre}
                </Celda>
              ) : null}
              <Celda ocultaMovil className="text-tinta-media">
                {venta.usuario.nombre}
              </Celda>
              <Celda className="whitespace-nowrap">
                {venta.anulada ? (
                  <Etiqueta tono="peligro">Anulada</Etiqueta>
                ) : (
                  <Etiqueta tono="exito">Vigente</Etiqueta>
                )}
                {esAdmin && venta.requiereRevision ? (
                  <Etiqueta tono="alerta" className="ml-1.5">
                    Revisar
                  </Etiqueta>
                ) : null}
                {venta.origenOffline ? (
                  <span className="ml-1.5 text-[11px] text-tinta-suave" title="Cobrada sin conexión">
                    offline
                  </span>
                ) : null}
              </Celda>
              <Celda
                derecha
                className={`cifras font-medium ${venta.anulada ? "line-through" : ""}`}
              >
                {formatoMoneda(aDecimal(venta.total))}
              </Celda>
            </Fila>
          ))}
        </Tabla>
      )}
    </section>
  );
}
