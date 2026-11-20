import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, Dato, EncabezadoPagina, Tarjeta, Volver } from "@/components/ui/pagina";
import { formatoMoneda, formatoRtn } from "@/lib/formato";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";
import { saldoDeCliente } from "@/lib/ventas/saldo";

export const metadata: Metadata = {
  title: "Cliente | Inversiones Ferrera",
};

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const { guardado } = await leerParametros(searchParams);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const saldo = await saldoDeCliente(prisma, cliente.id);

  return (
    <section>
      <Volver href="/clientes">Clientes</Volver>
      <EncabezadoPagina
        titulo={cliente.nombre}
        meta={
          <>
            <Etiqueta tono={cliente.tipo === "MAYORISTA" ? "info" : "neutro"}>
              {cliente.tipo === "MAYORISTA" ? "Mayorista" : "Minorista"}
            </Etiqueta>
            {cliente.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
          </>
        }
        acciones={
          <Link href={`/clientes/${cliente.id}/editar`} className={clasesBoton("secundario")}>
            <Icono nombre="editar" tamano={16} />
            Editar
          </Link>
        }
      />

      <AvisoGuardado nombre={guardado} />

      <Tarjeta className="mb-4 max-w-4xl px-5 py-4">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Dato etiqueta="Teléfono">
            {cliente.telefono ? (
              <a
                href={`tel:${cliente.telefono}`}
                className="cifras underline-offset-2 hover:underline"
              >
                {cliente.telefono}
              </a>
            ) : null}
          </Dato>
          <Dato etiqueta="RTN">
            {cliente.rtn ? <span className="cifras">{formatoRtn(cliente.rtn)}</span> : null}
          </Dato>
          <Dato etiqueta="Correo">
            {cliente.correo ? (
              <a
                href={`mailto:${cliente.correo}`}
                className="break-all underline-offset-2 hover:underline"
              >
                {cliente.correo}
              </a>
            ) : null}
          </Dato>
          <Dato etiqueta="Dirección">{cliente.direccion}</Dato>
          <div className="sm:col-span-2">
            <Dato etiqueta="Observaciones">
              {cliente.observaciones ? (
                <span className="whitespace-pre-line">{cliente.observaciones}</span>
              ) : null}
            </Dato>
          </div>
        </dl>
      </Tarjeta>

      <Tarjeta className="max-w-4xl px-5 py-4">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
              Saldo de la cuenta
            </dt>
            <dd
              className={`cifras text-[24px] font-semibold tracking-[-0.02em] ${saldo.gt(0) ? "text-tinta" : "text-tinta-suave"}`}
            >
              {formatoMoneda(saldo)}
            </dd>
            <dd className="text-[12px] text-tinta-suave">
              Ventas al fiado menos abonos y anulaciones.
            </dd>
          </div>
          <Dato etiqueta="Fiado">
            {!cliente.fiadoHabilitado
              ? "No habilitado"
              : cliente.limiteCredito === null
                ? "Habilitado, sin tope"
                : `Habilitado, hasta ${formatoMoneda(cliente.limiteCredito.toString())}`}
          </Dato>
        </dl>
      </Tarjeta>
    </section>
  );
}
