import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, Dato, EncabezadoPagina, Tarjeta, Volver } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { saldoDeProveedor } from "@/lib/compras/saldo";
import { estadoCuentaProveedor } from "@/lib/cuentas/estado-cuenta";
import { fecha, formatoMoneda, formatoRtn } from "@/lib/formato";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { EstadoCuenta } from "../../_components/estado-cuenta";

export const metadata: Metadata = {
  title: "Proveedor | Inversiones Ferrera",
};

export default async function ProveedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const { guardado } = await leerParametros(searchParams);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) notFound();

  const [saldo, movimientos, compras] = await Promise.all([
    saldoDeProveedor(prisma, proveedor.id),
    estadoCuentaProveedor(proveedor.id),
    prisma.compra.findMany({
      where: { proveedorId: proveedor.id },
      select: {
        id: true,
        fecha: true,
        numeroFactura: true,
        condicionPago: true,
        total: true,
        anulada: true,
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);

  return (
    <section>
      <Volver href="/proveedores">Proveedores</Volver>
      <EncabezadoPagina
        titulo={proveedor.nombre}
        meta={proveedor.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
        acciones={
          <Link
            href={`/proveedores/${proveedor.id}/editar`}
            className={clasesBoton("secundario")}
          >
            <Icono nombre="editar" tamano={16} />
            Editar
          </Link>
        }
      />

      <AvisoGuardado nombre={guardado} />

      <Tarjeta className="mb-4 max-w-4xl px-5 py-4">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Dato etiqueta="Teléfono">
            {proveedor.telefono ? (
              <a href={`tel:${proveedor.telefono}`} className="cifras underline-offset-2 hover:underline">
                {proveedor.telefono}
              </a>
            ) : null}
          </Dato>
          <Dato etiqueta="RTN">
            {proveedor.rtn ? <span className="cifras">{formatoRtn(proveedor.rtn)}</span> : null}
          </Dato>
          <Dato etiqueta="Correo">
            {proveedor.correo ? (
              <a
                href={`mailto:${proveedor.correo}`}
                className="break-all underline-offset-2 hover:underline"
              >
                {proveedor.correo}
              </a>
            ) : null}
          </Dato>
          <Dato etiqueta="Dirección">{proveedor.direccion}</Dato>
          <div className="sm:col-span-2">
            <Dato etiqueta="Observaciones">
              {proveedor.observaciones ? (
                <span className="whitespace-pre-line">{proveedor.observaciones}</span>
              ) : null}
            </Dato>
          </div>
        </dl>
      </Tarjeta>

      <Tarjeta className="mb-4 flex max-w-4xl flex-wrap items-end justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
            Saldo por pagar
          </p>
          <p
            className={`cifras text-[24px] font-semibold tracking-[-0.02em] ${saldo.gt(0) ? "text-tinta" : "text-tinta-suave"}`}
          >
            {formatoMoneda(saldo)}
          </p>
          <p className="text-[12px] text-tinta-suave">
            Compras a crédito menos pagos y anulaciones.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/compras?proveedor=${proveedor.id}`}
            className={clasesBoton("secundario", "sm")}
          >
            Ver todas sus compras
          </Link>
          {saldo.gt(0) ? (
            <Link
              href={`/proveedores/${proveedor.id}/pago`}
              className={clasesBoton("primario", "sm")}
            >
              <Icono nombre="mas" tamano={15} />
              Registrar pago
            </Link>
          ) : null}
        </div>
      </Tarjeta>

      <div className="mt-8 max-w-4xl">
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-tinta">
          Estado de cuenta
        </h2>
        <EstadoCuenta filas={movimientos} cuenta="proveedor" />
      </div>

      <div className="mt-8 max-w-4xl">
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-tinta">
          Últimas compras
        </h2>
        {compras.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borde px-4 py-6 text-center text-[13px] text-tinta-suave">
            Todavía no hay compras de este proveedor.
          </p>
        ) : (
          <Tabla
            columnas={[
              { label: "N°" },
              { label: "Fecha" },
              { label: "Factura", ocultaMovil: true },
              { label: "Condición" },
              { label: "Total", derecha: true },
            ]}
          >
            {compras.map((compra) => (
              <Fila key={compra.id} atenuada={compra.anulada}>
                <Celda className="cifras font-mono">
                  <Link
                    href={`/compras/${compra.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {compra.id}
                  </Link>
                  {compra.anulada ? (
                    <Etiqueta tono="peligro" className="ml-2">
                      Anulada
                    </Etiqueta>
                  ) : null}
                </Celda>
                <Celda className="cifras text-tinta-media">{fecha(compra.fecha)}</Celda>
                <Celda ocultaMovil className="cifras text-tinta-media">
                  {compra.numeroFactura ?? "—"}
                </Celda>
                <Celda>{compra.condicionPago === "CREDITO" ? "Crédito" : "Contado"}</Celda>
                <Celda
                  derecha
                  className={`cifras font-medium ${compra.anulada ? "line-through" : ""}`}
                >
                  {formatoMoneda(compra.total)}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </div>
    </section>
  );
}
