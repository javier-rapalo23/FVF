import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, Tarjeta, Volver } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { saldoDeProveedor } from "@/lib/compras/saldo";
import { fecha, formatoMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { guardarProveedor } from "../actions";
import { FormularioProveedor } from "../_components/formulario-proveedor";

export const metadata: Metadata = {
  title: "Editar proveedor | Inversiones Ferrera",
};

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) notFound();

  const [saldo, compras] = await Promise.all([
    saldoDeProveedor(prisma, proveedor.id),
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
      />

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
        <Link
          href={`/compras?proveedor=${proveedor.id}`}
          className={clasesBoton("secundario", "sm")}
        >
          Ver todas sus compras
        </Link>
      </Tarjeta>

      <FormularioProveedor
        accion={guardarProveedor.bind(null, proveedor.id)}
        esNuevo={false}
        inicial={{
          nombre: proveedor.nombre,
          telefono: proveedor.telefono ?? "",
          activo: proveedor.activo,
        }}
      />

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
