import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Etiqueta } from "@/components/ui/etiqueta";
import { Tarjeta, Volver } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { formatoFechaHora } from "@/lib/fecha";
import { cantidad, fecha, formatoMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { AnularCompra } from "../_components/anular-compra";

export const metadata: Metadata = { title: "Detalle de compra | Inversiones Ferrera" };

export default async function DetalleCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const compraId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!compraId) notFound();

  const compra = await prisma.compra.findUnique({
    where: { id: compraId },
    select: {
      id: true,
      fecha: true,
      numeroFactura: true,
      condicionPago: true,
      total: true,
      notas: true,
      anulada: true,
      creadoEn: true,
      proveedor: { select: { id: true, nombre: true } },
      sucursal: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
      detalles: {
        select: {
          id: true,
          cantidad: true,
          costoUnitario: true,
          subtotal: true,
          producto: { select: { id: true, nombre: true, idInterno: true, unidadVenta: true } },
        },
        orderBy: { id: "asc" },
      },
      anulacion: {
        select: { motivo: true, fecha: true, usuario: { select: { nombre: true } } },
      },
    },
  });
  if (!compra) notFound();

  const datos: { etiqueta: string; valor: ReactNode }[] = [
    {
      etiqueta: "Proveedor",
      valor: (
        <Link
          href={`/proveedores/${compra.proveedor.id}`}
          className="underline-offset-2 hover:underline"
        >
          {compra.proveedor.nombre}
        </Link>
      ),
    },
    { etiqueta: "Fecha de la factura", valor: fecha(compra.fecha) },
    { etiqueta: "N° de factura", valor: compra.numeroFactura ?? "—" },
    {
      etiqueta: "Condición",
      valor: compra.condicionPago === "CREDITO" ? "A crédito" : "De contado",
    },
    { etiqueta: "Sucursal", valor: compra.sucursal.nombre },
    {
      etiqueta: "Registrada",
      valor: `${formatoFechaHora(compra.creadoEn)} por ${compra.usuario.nombre}`,
    },
  ];

  return (
    <section>
      <Volver href="/compras">Compras</Volver>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="cifras text-[22px] font-semibold tracking-[-0.02em] text-tinta">
            Compra N° {compra.id}
          </h1>
          {compra.anulada ? (
            <Etiqueta tono="peligro">Anulada</Etiqueta>
          ) : (
            <Etiqueta tono="exito">Vigente</Etiqueta>
          )}
        </div>
        {compra.anulada ? null : (
          <AnularCompra compraId={compra.id} esCredito={compra.condicionPago === "CREDITO"} />
        )}
      </div>

      {compra.anulacion ? (
        <div className="mb-4 rounded-lg bg-peligro-fondo px-4 py-3 text-[13px] text-peligro-tinta">
          <p className="font-medium">
            Anulada el {formatoFechaHora(compra.anulacion.fecha)} por{" "}
            {compra.anulacion.usuario.nombre}
          </p>
          <p className="mt-0.5">Motivo: {compra.anulacion.motivo}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div>
          <Tabla
            columnas={[
              { label: "Producto" },
              { label: "Cantidad", derecha: true },
              { label: "Costo", derecha: true },
              { label: "Subtotal", derecha: true },
            ]}
          >
            {compra.detalles.map((d) => (
              <Fila key={d.id} atenuada={compra.anulada}>
                <Celda>
                  <Link
                    href={`/productos/${d.producto.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {d.producto.nombre}
                  </Link>
                  <span className="cifras ml-2 text-[12px] text-tinta-suave">
                    {d.producto.idInterno}
                  </span>
                </Celda>
                <Celda derecha className="cifras whitespace-nowrap">
                  {cantidad(d.cantidad, d.producto.unidadVenta)}
                </Celda>
                <Celda derecha className="cifras whitespace-nowrap text-tinta-media">
                  {formatoMoneda(d.costoUnitario)}
                </Celda>
                <Celda derecha className="cifras whitespace-nowrap font-medium">
                  {formatoMoneda(d.subtotal)}
                </Celda>
              </Fila>
            ))}
          </Tabla>
          <div className="mt-3 flex items-baseline justify-end gap-3 px-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
              Total
            </span>
            <span
              className={`cifras text-[22px] font-semibold tracking-[-0.02em] text-tinta ${compra.anulada ? "line-through" : ""}`}
            >
              {formatoMoneda(compra.total)}
            </span>
          </div>
        </div>

        <Tarjeta className="px-5 py-4">
          <dl className="space-y-3">
            {datos.map((d) => (
              <div key={d.etiqueta}>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  {d.etiqueta}
                </dt>
                <dd className="mt-0.5 text-[13px] text-tinta">{d.valor}</dd>
              </div>
            ))}
            {compra.notas ? (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  Notas
                </dt>
                <dd className="mt-0.5 whitespace-pre-line text-[13px] text-tinta">
                  {compra.notas}
                </dd>
              </div>
            ) : null}
          </dl>
        </Tarjeta>
      </div>
    </section>
  );
}
