import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, Dato, EncabezadoPagina, Tarjeta, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { formatoFechaHora } from "@/lib/fecha";
import { fecha, formatoMoneda } from "@/lib/formato";
import { NOMBRE_CATEGORIA, NOMBRE_MEDIO, type EfectoAnulacion } from "@/lib/gastos/tipos";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { AnularGasto } from "../_components/anular-gasto";

export const metadata: Metadata = { title: "Gasto | Inversiones Ferrera" };

export default async function GastoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const { id } = await params;
  const gastoId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!gastoId) notFound();

  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";
  const { guardado } = await leerParametros(searchParams);

  const gasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    include: {
      concepto: { select: { nombre: true, categoria: true } },
      sucursal: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
      anulacion: { include: { usuario: { select: { nombre: true } } } },
    },
  });
  // El empleado solo ve los gastos de caja de su sucursal.
  if (
    !gasto ||
    (!esAdmin && (gasto.medioPago !== "EFECTIVO_CAJA" || gasto.sucursalId !== usuario.sucursalId))
  ) {
    notFound();
  }

  const deCaja = gasto.medioPago === "EFECTIVO_CAJA";
  const efecto: EfectoAnulacion = !deCaja
    ? { tipo: "OTRO_MEDIO" }
    : gasto.cierreCajaId === null
      ? { tipo: "CAJA_PENDIENTE" }
      : { tipo: "CAJA_CERRADA", cierreId: gasto.cierreCajaId };

  return (
    <section>
      <Volver href="/gastos">Gastos</Volver>
      <EncabezadoPagina
        titulo={`Gasto N° ${gasto.id}`}
        meta={gasto.anulado ? <Etiqueta tono="peligro">Anulado</Etiqueta> : null}
        acciones={
          esAdmin && !gasto.anulado ? (
            <>
              <Link href={`/gastos/${gasto.id}/editar`} className={clasesBoton("secundario")}>
                <Icono nombre="editar" tamano={16} />
                Editar
              </Link>
              <AnularGasto gastoId={gasto.id} efecto={efecto} />
            </>
          ) : null
        }
      />

      <AvisoGuardado nombre={guardado} />

      {gasto.anulacion ? (
        <div className="mb-4 max-w-4xl rounded-lg bg-peligro-fondo px-4 py-3 text-[13px] text-peligro-tinta">
          <p className="font-medium">
            Anulado el {formatoFechaHora(gasto.anulacion.fecha)} por {gasto.anulacion.usuario.nombre}
          </p>
          <p className="mt-0.5">{gasto.anulacion.motivo}</p>
        </div>
      ) : null}

      <Tarjeta className="mb-4 max-w-4xl px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">Monto</p>
        <p
          className={`cifras text-[24px] font-semibold tracking-[-0.02em] ${gasto.anulado ? "text-tinta-suave line-through" : "text-tinta"}`}
        >
          {formatoMoneda(gasto.monto)}
        </p>
        <p className="mt-1 text-[13px] text-tinta">{gasto.descripcion}</p>
      </Tarjeta>

      <Tarjeta className="max-w-4xl px-5 py-4">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Dato etiqueta="Concepto">
            {gasto.concepto.nombre}{" "}
            <span className="text-tinta-suave">· {NOMBRE_CATEGORIA[gasto.concepto.categoria]}</span>
          </Dato>
          <Dato etiqueta="Fecha del pago">
            <span className="cifras">{fecha(gasto.fecha)}</span>
          </Dato>
          <Dato etiqueta="Medio de pago">{NOMBRE_MEDIO[gasto.medioPago]}</Dato>
          <Dato etiqueta="Sucursal">{gasto.sucursal?.nombre ?? "General (sin sucursal)"}</Dato>
          <Dato etiqueta="N° de comprobante">
            {gasto.numeroComprobante ? <span className="cifras">{gasto.numeroComprobante}</span> : null}
          </Dato>
          <Dato etiqueta="Registrado">
            {gasto.usuario.nombre}{" "}
            <span className="cifras text-tinta-suave">· {formatoFechaHora(gasto.creadoEn)}</span>
          </Dato>
          {deCaja ? (
            <div className="sm:col-span-2">
              <Dato etiqueta="Cierre de caja">
                {gasto.cierreCajaId ? (
                  <Link
                    href={`/cierres/${gasto.cierreCajaId}`}
                    className="cifras underline-offset-2 hover:underline"
                  >
                    Cierre N° {gasto.cierreCajaId}
                  </Link>
                ) : gasto.anulado ? (
                  <span className="text-tinta-media">Anulado antes del cierre: no resta.</span>
                ) : (
                  <span className="text-tinta-media">Pendiente del próximo cierre.</span>
                )}
              </Dato>
            </div>
          ) : null}
        </dl>
      </Tarjeta>
    </section>
  );
}
