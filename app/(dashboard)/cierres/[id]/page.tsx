import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Etiqueta } from "@/components/ui/etiqueta";
import { Tarjeta, Volver } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { aDecimal } from "@/lib/calculos";
import { DENOMINACIONES } from "@/lib/config";
import { formatoFechaHora, formatoHora } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { NOMBRE_METODO } from "../../caja/_components/opciones";
import { RevisarCierre } from "../_components/revisar-cierre";

export const metadata: Metadata = { title: "Cierre de caja | Inversiones Ferrera" };

/** Tope de ventas listadas en el detalle; el resto se resume. */
const VENTAS_LISTADAS = 300;

export default async function DetalleCierrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cierreId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!cierreId) notFound();

  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  const cierre = await prisma.cierreCaja.findUnique({
    where: { id: cierreId },
    include: {
      sucursal: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
      revisadoPor: { select: { nombre: true } },
      ventas: {
        select: {
          id: true,
          fecha: true,
          metodoPago: true,
          total: true,
          anulada: true,
          origenOffline: true,
          cliente: { select: { nombre: true } },
        },
        orderBy: { id: "asc" },
        take: VENTAS_LISTADAS,
      },
      gastos: {
        select: {
          id: true,
          monto: true,
          anulado: true,
          descripcion: true,
          creadoEn: true,
          concepto: { select: { nombre: true } },
        },
        orderBy: { id: "asc" },
      },
      abonos: {
        select: {
          id: true,
          monto: true,
          fecha: true,
          cliente: { select: { id: true, nombre: true } },
        },
        orderBy: { id: "asc" },
      },
      pagosProveedor: {
        select: {
          id: true,
          monto: true,
          fecha: true,
          nota: true,
          proveedor: { select: { id: true, nombre: true } },
        },
        orderBy: { id: "asc" },
      },
      _count: { select: { ventas: true } },
    },
  });
  // El empleado solo ve los cierres de su sucursal.
  if (!cierre || (!esAdmin && cierre.sucursalId !== usuario.sucursalId)) notFound();

  const retiro = cierre.totalContado.minus(cierre.fondoSiguiente);
  const detalle = leerDetalle(cierre.detalleConteo);

  const datos: { etiqueta: string; valor: ReactNode }[] = [
    { etiqueta: "Sucursal", valor: cierre.sucursal.nombre },
    {
      etiqueta: "Período",
      valor: `${formatoFechaHora(cierre.desde)} → ${formatoFechaHora(cierre.fecha)}`,
    },
    { etiqueta: "Cerró", valor: cierre.usuario.nombre },
    {
      etiqueta: "Cierre anterior",
      valor: cierre.cierreAnteriorId ? (
        <Link href={`/cierres/${cierre.cierreAnteriorId}`} className="underline-offset-2 hover:underline">
          N° {cierre.cierreAnteriorId}
        </Link>
      ) : (
        "Primer cierre de la caja"
      ),
    },
  ];

  return (
    <section>
      <Volver href="/cierres">Cierres de caja</Volver>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="cifras text-[22px] font-semibold tracking-[-0.02em] text-tinta">
            Cierre N° {cierre.id}
          </h1>
          {cierre.revisadoPorId ? (
            <Etiqueta tono="exito">Revisado</Etiqueta>
          ) : (
            <Etiqueta>Sin revisar</Etiqueta>
          )}
        </div>
        {esAdmin && !cierre.revisadoPorId ? <RevisarCierre cierreId={cierre.id} /> : null}
      </div>

      {cierre.revisadoPor && cierre.revisadoEn ? (
        <div className="mb-4 rounded-lg bg-exito-fondo px-4 py-3 text-[13px] text-exito-tinta">
          <p className="font-medium">
            Revisado el {formatoFechaHora(cierre.revisadoEn)} por {cierre.revisadoPor.nombre}
          </p>
          {cierre.notaRevision ? <p className="mt-0.5">{cierre.notaRevision}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-4">
          <Tarjeta className="px-5 py-4">
            <dl className="cifras space-y-1.5 text-[13px]">
              <Monto etiqueta="Fondo inicial" valor={cierre.fondoInicial} />
              <Monto etiqueta={`Ventas en efectivo`} valor={cierre.ventasEfectivo} signo="+" />
              {cierre.devolucionesEfectivo.gt(0) ? (
                <Monto
                  etiqueta="Devoluciones de ventas ya cerradas"
                  valor={cierre.devolucionesEfectivo}
                  signo="−"
                />
              ) : null}
              {cierre.abonosEfectivo.gt(0) ? (
                <Monto
                  etiqueta="Abonos de clientes en efectivo"
                  valor={cierre.abonosEfectivo}
                  signo="+"
                />
              ) : null}
              {cierre.pagosProveedorCaja.gt(0) ? (
                <Monto etiqueta="Pagos a proveedores" valor={cierre.pagosProveedorCaja} signo="−" />
              ) : null}
              {cierre.gastosCaja.gt(0) ? (
                <Monto etiqueta="Gastos de caja" valor={cierre.gastosCaja} signo="−" />
              ) : null}
              <Separador />
              <Monto etiqueta="Esperado" valor={cierre.totalSistema} fuerte />
              <Monto etiqueta="Contado" valor={cierre.totalContado} fuerte />
              <Separador />
              <Monto
                etiqueta={
                  cierre.diferencia.isZero() ? "Diferencia: cuadra" : cierre.diferencia.gt(0) ? "Sobrante" : "Faltante"
                }
                valor={cierre.diferencia}
                tono={cierre.diferencia.gt(0) ? "exito" : cierre.diferencia.lt(0) ? "peligro" : undefined}
                fuerte
              />
              <Monto etiqueta="Quedó en la caja" valor={cierre.fondoSiguiente} />
              <Monto etiqueta="Retiro" valor={retiro} />
            </dl>
          </Tarjeta>

          {detalle.length > 0 ? (
            <Tabla
              columnas={[
                { label: "Billetes y monedas" },
                { label: "Cantidad", derecha: true },
                { label: "Subtotal", derecha: true },
              ]}
            >
              {detalle.map(({ denominacion, cantidad }) => (
                <Fila key={denominacion}>
                  <Celda className="cifras">
                    {Number(denominacion) >= 1
                      ? `L ${Number(denominacion)}`
                      : `${Math.round(Number(denominacion) * 100)} ctvs`}
                  </Celda>
                  <Celda derecha className="cifras text-tinta-media">
                    {cantidad}
                  </Celda>
                  <Celda derecha className="cifras">
                    {formatoMoneda(aDecimal(denominacion).mul(cantidad))}
                  </Celda>
                </Fila>
              ))}
            </Tabla>
          ) : null}

          <details className="rounded-xl border border-borde bg-superficie">
            <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-tinta">
              Ventas incluidas ({cierre._count.ventas})
            </summary>
            {cierre.ventas.length === 0 ? (
              <p className="px-5 pb-4 text-[12px] text-tinta-suave">Ninguna venta en este cierre.</p>
            ) : (
              <div className="border-t border-borde">
                <Tabla
                  columnas={[
                    { label: "N°" },
                    { label: "Hora" },
                    { label: "Cliente", ocultaMovil: true },
                    { label: "Pago" },
                    { label: "Total", derecha: true },
                  ]}
                >
                  {cierre.ventas.map((v) => (
                    <Fila key={v.id} atenuada={v.anulada}>
                      <Celda className="cifras font-mono">
                        <Link href={`/caja/ventas/${v.id}`} className="underline-offset-2 hover:underline">
                          {v.id}
                        </Link>
                      </Celda>
                      <Celda className="cifras whitespace-nowrap text-tinta-media">
                        {formatoHora(v.fecha)}
                        {v.origenOffline ? (
                          <span className="ml-1.5 text-[11px] text-tinta-suave">offline</span>
                        ) : null}
                      </Celda>
                      <Celda ocultaMovil className="text-tinta-media">
                        {v.cliente?.nombre ?? "—"}
                      </Celda>
                      <Celda>
                        {NOMBRE_METODO[v.metodoPago]}
                        {v.anulada ? (
                          <Etiqueta tono="peligro" className="ml-1.5">
                            Anulada
                          </Etiqueta>
                        ) : null}
                      </Celda>
                      <Celda derecha className={`cifras ${v.anulada ? "line-through" : ""}`}>
                        {formatoMoneda(v.total)}
                      </Celda>
                    </Fila>
                  ))}
                </Tabla>
                {cierre._count.ventas > cierre.ventas.length ? (
                  <p className="px-5 py-3 text-[12px] text-tinta-suave">
                    Se muestran las primeras {cierre.ventas.length}.
                  </p>
                ) : null}
              </div>
            )}
          </details>

          {cierre.gastos.length > 0 ? (
            <details className="rounded-xl border border-borde bg-superficie">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-tinta">
                Gastos de caja incluidos ({cierre.gastos.length})
              </summary>
              <div className="border-t border-borde">
                <Tabla
                  columnas={[
                    { label: "N°" },
                    { label: "Hora" },
                    { label: "Concepto" },
                    { label: "Descripción", ocultaMovil: true },
                    { label: "Monto", derecha: true },
                  ]}
                >
                  {cierre.gastos.map((g) => (
                    <Fila key={g.id} atenuada={g.anulado}>
                      <Celda className="cifras font-mono">
                        <Link href={`/gastos/${g.id}`} className="underline-offset-2 hover:underline">
                          {g.id}
                        </Link>
                      </Celda>
                      <Celda className="cifras whitespace-nowrap text-tinta-media">
                        {formatoHora(g.creadoEn)}
                      </Celda>
                      <Celda>
                        {g.concepto.nombre}
                        {g.anulado ? (
                          <Etiqueta tono="peligro" className="ml-1.5">
                            Anulado
                          </Etiqueta>
                        ) : null}
                      </Celda>
                      <Celda ocultaMovil className="text-tinta-media">
                        {g.descripcion}
                      </Celda>
                      <Celda derecha className={`cifras ${g.anulado ? "line-through" : ""}`}>
                        {formatoMoneda(g.monto)}
                      </Celda>
                    </Fila>
                  ))}
                </Tabla>
                <p className="px-5 py-3 text-[12px] text-tinta-suave">
                  Los anulados antes del cierre no restan. Uno anulado después no cambia este cierre.
                </p>
              </div>
            </details>
          ) : null}

          {cierre.abonos.length > 0 ? (
            <details className="rounded-xl border border-borde bg-superficie">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-tinta">
                Abonos en efectivo incluidos ({cierre.abonos.length})
              </summary>
              <div className="border-t border-borde">
                <Tabla
                  columnas={[
                    { label: "N°" },
                    { label: "Hora" },
                    { label: "Cliente" },
                    { label: "Monto", derecha: true },
                  ]}
                >
                  {cierre.abonos.map((a) => (
                    <Fila key={a.id}>
                      <Celda className="cifras font-mono">
                        <Link href={`/caja/abonos/${a.id}`} className="underline-offset-2 hover:underline">
                          {a.id}
                        </Link>
                      </Celda>
                      <Celda className="cifras whitespace-nowrap text-tinta-media">
                        {formatoHora(a.fecha)}
                      </Celda>
                      <Celda>{a.cliente.nombre}</Celda>
                      <Celda derecha className="cifras">
                        {formatoMoneda(a.monto)}
                      </Celda>
                    </Fila>
                  ))}
                </Tabla>
              </div>
            </details>
          ) : null}

          {cierre.pagosProveedor.length > 0 ? (
            <details className="rounded-xl border border-borde bg-superficie">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-tinta">
                Pagos a proveedores incluidos ({cierre.pagosProveedor.length})
              </summary>
              <div className="border-t border-borde">
                <Tabla
                  columnas={[
                    { label: "N°" },
                    { label: "Hora" },
                    { label: "Proveedor" },
                    { label: "Nota", ocultaMovil: true },
                    { label: "Monto", derecha: true },
                  ]}
                >
                  {cierre.pagosProveedor.map((p) => (
                    <Fila key={p.id}>
                      <Celda className="cifras font-mono text-tinta-media">{p.id}</Celda>
                      <Celda className="cifras whitespace-nowrap text-tinta-media">
                        {formatoHora(p.fecha)}
                      </Celda>
                      <Celda>
                        {esAdmin ? (
                          <Link
                            href={`/proveedores/${p.proveedor.id}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {p.proveedor.nombre}
                          </Link>
                        ) : (
                          p.proveedor.nombre
                        )}
                      </Celda>
                      <Celda ocultaMovil className="text-tinta-media">
                        {p.nota ?? "—"}
                      </Celda>
                      <Celda derecha className="cifras">
                        {formatoMoneda(p.monto)}
                      </Celda>
                    </Fila>
                  ))}
                </Tabla>
              </div>
            </details>
          ) : null}
        </div>

        <Tarjeta className="px-5 py-4">
          <dl className="space-y-3">
            {datos.map((d) => (
              <div key={d.etiqueta}>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  {d.etiqueta}
                </dt>
                <dd className="cifras mt-0.5 text-[13px] text-tinta">{d.valor}</dd>
              </div>
            ))}
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Ventas del período
              </dt>
              <dd className="cifras mt-1 space-y-1 text-[13px]">
                <p className="text-tinta">{cierre.cantidadVentas} vigentes</p>
                <MontoSimple etiqueta="Efectivo" valor={cierre.ventasEfectivo} />
                <MontoSimple etiqueta="Transferencia" valor={cierre.ventasTransferencia} />
                <MontoSimple etiqueta="Tarjeta" valor={cierre.ventasTarjeta} />
                <MontoSimple etiqueta="Fiado" valor={cierre.ventasFiado} />
              </dd>
            </div>
            {cierre.notas ? (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  Nota del cierre
                </dt>
                <dd className="mt-0.5 whitespace-pre-line text-[13px] text-tinta">{cierre.notas}</dd>
              </div>
            ) : null}
          </dl>
        </Tarjeta>
      </div>
    </section>
  );
}

function leerDetalle(valor: Prisma.JsonValue | null): { denominacion: string; cantidad: number }[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  return DENOMINACIONES.flatMap((d) => {
    const cantidad = (valor as Record<string, unknown>)[d];
    return typeof cantidad === "number" && cantidad > 0 ? [{ denominacion: d, cantidad }] : [];
  });
}

function Separador() {
  return <div className="border-t border-borde" />;
}

function Monto({
  etiqueta,
  valor,
  signo,
  tono,
  fuerte = false,
}: {
  etiqueta: string;
  valor: Prisma.Decimal;
  signo?: "+" | "−";
  tono?: "exito" | "peligro";
  fuerte?: boolean;
}) {
  const color =
    tono === "exito" ? "text-exito-tinta" : tono === "peligro" ? "text-peligro-tinta" : "text-tinta";
  return (
    <div className="flex justify-between gap-3">
      <dt className={fuerte ? "font-medium text-tinta" : "text-tinta-media"}>{etiqueta}</dt>
      <dd className={`${color} ${fuerte ? "font-semibold" : ""}`}>
        {signo ? `${signo} ` : ""}
        {formatoMoneda(signo ? valor.abs() : valor)}
      </dd>
    </div>
  );
}

function MontoSimple({ etiqueta, valor }: { etiqueta: string; valor: Prisma.Decimal }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-tinta-media">{etiqueta}</span>
      <span className="text-tinta">{formatoMoneda(valor)}</span>
    </p>
  );
}
