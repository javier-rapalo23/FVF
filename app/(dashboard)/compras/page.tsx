import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { EncabezadoPagina, EstadoVacio, Tarjeta } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { aDecimal } from "@/lib/calculos";
import { diaDelNegocio, esDiaValido, inicioYFinDelDia, sumarDias } from "@/lib/fecha";
import { fecha, formatoMoneda } from "@/lib/formato";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Compras | Inversiones Ferrera",
};

const POR_PAGINA = 50;
const DIAS_POR_DEFECTO = 30;

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const parametros = await leerParametros(searchParams);
  const hoy = diaDelNegocio();

  const desde = esDiaValido(parametros.desde ?? "")
    ? parametros.desde!
    : sumarDias(hoy, -DIAS_POR_DEFECTO);
  const hasta = esDiaValido(parametros.hasta ?? "") ? parametros.hasta! : hoy;
  const proveedorId = /^\d{1,9}$/.test(parametros.proveedor ?? "")
    ? Number(parametros.proveedor)
    : null;
  const incluirAnuladas = parametros.anuladas === "1";
  const pagina = Math.max(1, Number(parametros.pagina) || 1);

  const rango: Prisma.CompraWhereInput = {
    fecha: { gte: inicioYFinDelDia(desde).inicio, lt: inicioYFinDelDia(hasta).fin },
    ...(proveedorId ? { proveedorId } : {}),
  };
  const where: Prisma.CompraWhereInput = {
    ...rango,
    ...(incluirAnuladas ? {} : { anulada: false }),
  };

  const [compras, cantidad, totales, proveedores, hayCompras] = await Promise.all([
    prisma.compra.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        numeroFactura: true,
        condicionPago: true,
        total: true,
        anulada: true,
        proveedor: { select: { nombre: true } },
        _count: { select: { detalles: true } },
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.compra.count({ where }),
    // Las anuladas nunca suman, aunque se muestren.
    prisma.compra.groupBy({
      by: ["condicionPago"],
      where: { ...rango, anulada: false },
      _sum: { total: true },
    }),
    prisma.proveedor.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.compra.count({ take: 1 }),
  ]);

  const totalCondicion = (condicion: "CONTADO" | "CREDITO") =>
    aDecimal(totales.find((t) => t.condicionPago === condicion)?._sum.total ?? 0);
  const contado = totalCondicion("CONTADO");
  const credito = totalCondicion("CREDITO");
  const paginas = Math.max(1, Math.ceil(cantidad / POR_PAGINA));

  function enlacePagina(destino: number): string {
    const p = new URLSearchParams({ desde, hasta });
    if (proveedorId) p.set("proveedor", String(proveedorId));
    if (incluirAnuladas) p.set("anuladas", "1");
    if (destino > 1) p.set("pagina", String(destino));
    return `/compras?${p.toString()}`;
  }

  const nuevaCompra = (
    <Link href="/compras/nueva" className={clasesBoton("primario")}>
      <Icono nombre="mas" tamano={16} />
      Nueva compra
    </Link>
  );

  return (
    <section>
      <EncabezadoPagina
        titulo="Compras"
        descripcion="Mercadería comprada a proveedores. Cada compra suma al stock de la sucursal; las de crédito, a la cuenta por pagar."
        acciones={nuevaCompra}
      />

      {hayCompras === 0 ? (
        <EstadoVacio icono="compras" titulo="Todavía no hay compras" accion={nuevaCompra}>
          Registrá la primera factura de un proveedor para que la mercadería entre al stock.
        </EstadoVacio>
      ) : (
        <>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[11px] text-tinta-suave">Desde</span>
              <input
                type="date"
                name="desde"
                defaultValue={desde}
                max={hoy}
                className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] text-tinta-suave">Hasta</span>
              <input
                type="date"
                name="hasta"
                defaultValue={hasta}
                max={hoy}
                className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] text-tinta-suave">Proveedor</span>
              <select
                name="proveedor"
                defaultValue={proveedorId ?? ""}
                className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
              >
                <option value="">Todos</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-9 items-center gap-2 px-1 text-[13px] text-tinta-media">
              <input
                type="checkbox"
                name="anuladas"
                value="1"
                defaultChecked={incluirAnuladas}
                className="h-4 w-4 accent-marca-600"
              />
              Incluir anuladas
            </label>
            <Boton type="submit">Filtrar</Boton>
            {parametros.desde || parametros.hasta || proveedorId || incluirAnuladas ? (
              <Link href="/compras" className={clasesBoton("fantasma")}>
                Limpiar
              </Link>
            ) : null}
          </form>

          <Tarjeta className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Total comprado
              </p>
              <p className="cifras text-[24px] font-semibold tracking-[-0.02em] text-tinta">
                {formatoMoneda(contado.plus(credito))}
              </p>
            </div>
            <div className="cifras text-[13px]">
              <span className="text-tinta-suave">Contado </span>
              <span className="text-tinta">{formatoMoneda(contado)}</span>
            </div>
            <div className="cifras text-[13px]">
              <span className="text-tinta-suave">Crédito </span>
              <span className="text-tinta">{formatoMoneda(credito)}</span>
            </div>
            <p className="text-[12px] text-tinta-suave">
              {fecha(new Date(`${desde}T12:00:00.000Z`))} al{" "}
              {fecha(new Date(`${hasta}T12:00:00.000Z`))}
            </p>
          </Tarjeta>

          {compras.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ninguna compra coincide con los filtros.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                columnas={[
                  { label: "N°" },
                  { label: "Fecha" },
                  { label: "Proveedor" },
                  { label: "Factura", ocultaMovil: true },
                  { label: "Condición" },
                  { label: "Líneas", derecha: true, ocultaMovil: true },
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
                    </Celda>
                    <Celda className="cifras whitespace-nowrap text-tinta-media">
                      {fecha(compra.fecha)}
                    </Celda>
                    <Celda>
                      {compra.proveedor.nombre}
                      {compra.anulada ? (
                        <Etiqueta tono="peligro" className="ml-2">
                          Anulada
                        </Etiqueta>
                      ) : null}
                    </Celda>
                    <Celda ocultaMovil className="cifras text-tinta-media">
                      {compra.numeroFactura ?? "—"}
                    </Celda>
                    <Celda>
                      {compra.condicionPago === "CREDITO" ? (
                        <Etiqueta tono="alerta">Crédito</Etiqueta>
                      ) : (
                        <Etiqueta>Contado</Etiqueta>
                      )}
                    </Celda>
                    <Celda derecha ocultaMovil className="cifras text-tinta-media">
                      {compra._count.detalles}
                    </Celda>
                    <Celda
                      derecha
                      className={`cifras font-medium ${compra.anulada ? "line-through" : ""}`}
                    >
                      {formatoMoneda(compra.total)}
                    </Celda>
                  </Fila>
                ))}
              </Tabla>

              <div className="mt-3 flex items-center justify-between text-[12px] text-tinta-suave">
                <span>
                  {cantidad} {cantidad === 1 ? "compra" : "compras"}
                  {paginas > 1 ? ` · página ${pagina} de ${paginas}` : ""}
                </span>
                {paginas > 1 ? (
                  <div className="flex gap-2">
                    {pagina > 1 ? (
                      <Link href={enlacePagina(pagina - 1)} className={clasesBoton("secundario", "sm")}>
                        Anterior
                      </Link>
                    ) : null}
                    {pagina < paginas ? (
                      <Link href={enlacePagina(pagina + 1)} className={clasesBoton("secundario", "sm")}>
                        Siguiente
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
