import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Etiqueta } from "@/components/ui/etiqueta";
import { Tarjeta, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { formatoFechaHora } from "@/lib/fecha";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";
import { textoCantidad, textoMonto } from "@/lib/ventas/calculos";

import { AnularVenta, BotonImprimir } from "../../_components/acciones-venta";
import { Comprobante } from "../../_components/comprobante";
import { NOMBRE_METODO } from "../../_components/opciones";

export const metadata: Metadata = { title: "Detalle de venta | Inversiones Ferrera" };

export default async function DetalleVentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  const { id } = await params;
  const ventaId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!ventaId) notFound();

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    select: {
      id: true,
      fecha: true,
      canal: true,
      metodoPago: true,
      total: true,
      notas: true,
      anulada: true,
      sucursalId: true,
      sucursal: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
      cliente: { select: { nombre: true } },
      detalles: {
        select: {
          id: true,
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          producto: { select: { nombre: true, unidadVenta: true } },
        },
        orderBy: { id: "asc" },
      },
      anulacion: {
        select: {
          motivo: true,
          reingresaStock: true,
          fecha: true,
          usuario: { select: { nombre: true } },
        },
      },
    },
  });

  // Un empleado solo ve las ventas de su sucursal.
  if (!venta || (usuario.rol !== "ADMINISTRADOR" && venta.sucursalId !== usuario.sucursalId)) {
    notFound();
  }

  const { imprimir } = await leerParametros(searchParams);
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  return (
    <section>
      {/* Márgenes del papel del comprobante: solo existen en esta pantalla. */}
      <style>{"@media print { @page { margin: 4mm; } }"}</style>

      <div className="no-imprimir">
        <Volver href="/caja/ventas">Ventas del día</Volver>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="cifras text-[22px] font-semibold tracking-[-0.02em] text-tinta">
              Venta N° {venta.id}
            </h1>
            {venta.anulada ? (
              <Etiqueta tono="peligro">Anulada</Etiqueta>
            ) : (
              <Etiqueta tono="exito">Vigente</Etiqueta>
            )}
          </div>
          <div className="flex items-center gap-2">
            {esAdmin && !venta.anulada ? (
              <AnularVenta ventaId={venta.id} esFiado={venta.metodoPago === "FIADO"} />
            ) : null}
            <BotonImprimir automatico={imprimir === "1"} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Comprobante
          venta={{
            id: venta.id,
            fecha: venta.fecha,
            sucursal: venta.sucursal.nombre,
            cajero: venta.usuario.nombre,
            cliente: venta.cliente?.nombre ?? null,
            canal: venta.canal,
            notas: venta.notas,
            metodoPago: venta.metodoPago,
            total: textoMonto(venta.total),
            anulada: venta.anulada,
            lineas: venta.detalles.map((detalle) => ({
              id: detalle.id,
              producto: detalle.producto.nombre,
              unidadVenta: detalle.producto.unidadVenta,
              cantidad: textoCantidad(detalle.cantidad),
              precioUnitario: textoMonto(detalle.precioUnitario),
              subtotal: textoMonto(detalle.subtotal),
            })),
          }}
        />

        <div className="no-imprimir min-w-0 max-w-md flex-1 space-y-4">
          <Tarjeta className="px-5 py-4">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt className="text-tinta-suave">Fecha</dt>
              <dd className="cifras text-tinta">{formatoFechaHora(venta.fecha)}</dd>
              <dt className="text-tinta-suave">Canal</dt>
              <dd className="text-tinta">{venta.canal === "PEDIDO" ? "Pedido" : "Local"}</dd>
              <dt className="text-tinta-suave">Pago</dt>
              <dd className="text-tinta">{NOMBRE_METODO[venta.metodoPago]}</dd>
              <dt className="text-tinta-suave">Cliente</dt>
              <dd className="text-tinta">{venta.cliente?.nombre ?? "Sin cliente"}</dd>
              <dt className="text-tinta-suave">Vendió</dt>
              <dd className="text-tinta">{venta.usuario.nombre}</dd>
              <dt className="text-tinta-suave">Sucursal</dt>
              <dd className="text-tinta">{venta.sucursal.nombre}</dd>
              {venta.notas ? (
                <>
                  <dt className="text-tinta-suave">Notas</dt>
                  <dd className="whitespace-pre-line text-tinta">{venta.notas}</dd>
                </>
              ) : null}
            </dl>
          </Tarjeta>

          {venta.anulacion ? (
            <div className="rounded-xl bg-peligro-fondo px-5 py-4 text-[13px] text-peligro-tinta">
              <p className="font-medium">
                Anulada por {venta.anulacion.usuario.nombre} el{" "}
                {formatoFechaHora(venta.anulacion.fecha)}
              </p>
              <p className="mt-1">Motivo: {venta.anulacion.motivo}</p>
              <p className="mt-1 text-peligro-tinta/80">
                {venta.anulacion.reingresaStock
                  ? "El producto volvió al stock."
                  : "El producto no volvió al stock."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
