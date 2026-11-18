import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { EncabezadoPagina, Tarjeta, Volver } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { requerirUsuarioActivo } from "@/lib/acceso";
import {
  diaDelNegocio,
  esDiaValido,
  formatoFechaHora,
  inicioYFinDelDia,
  sumarDias,
} from "@/lib/fecha";
import { cantidad, fecha, formatoMoneda } from "@/lib/formato";
import { kardexProducto, type TipoMovimientoKardex } from "@/lib/inventario/kardex";
import { sucursalDePantalla } from "@/lib/inventario/sucursal";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Historial de stock | Inversiones Ferrera" };

const DIAS_POR_DEFECTO = 30;

const TIPOS: Record<
  TipoMovimientoKardex,
  { label: string; tono: "neutro" | "exito" | "alerta" | "peligro" | "info" }
> = {
  VENTA: { label: "Venta", tono: "neutro" },
  ANULACION_VENTA: { label: "Anulación de venta", tono: "info" },
  COMPRA: { label: "Compra", tono: "exito" },
  ANULACION_COMPRA: { label: "Anulación de compra", tono: "peligro" },
  CONTEO: { label: "Conteo", tono: "info" },
  MERMA: { label: "Merma", tono: "alerta" },
};

export default async function HistorialProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ productoId: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const { productoId: crudo } = await params;
  const productoId = /^\d{1,9}$/.test(crudo) ? Number(crudo) : null;
  if (!productoId) notFound();

  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  const parametros = await leerParametros(searchParams);
  const [contexto, producto] = await Promise.all([
    sucursalDePantalla(usuario, parametros.sucursal),
    prisma.producto.findUnique({
      where: { id: productoId },
      select: {
        id: true,
        idInterno: true,
        nombre: true,
        unidadVenta: true,
        activo: true,
        stockMinimo: true,
        costoActual: true,
        categoria: { select: { nombre: true } },
      },
    }),
  ]);
  if (!producto || !contexto) notFound();
  const { sucursal, opciones } = contexto;

  const hoy = diaDelNegocio();
  let desde = esDiaValido(parametros.desde ?? "")
    ? parametros.desde!
    : sumarDias(hoy, -DIAS_POR_DEFECTO);
  let hasta = esDiaValido(parametros.hasta ?? "") ? parametros.hasta! : hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const kardex = await kardexProducto({
    productoId: producto.id,
    sucursalId: sucursal.id,
    inicio: inicioYFinDelDia(desde).inicio,
    fin: inicioYFinDelDia(hasta).fin,
  });

  const unidad = producto.unidadVenta;
  const consultaSucursal = opciones.length > 0 ? `?sucursal=${sucursal.id}` : "";
  const conSigno = (valor: Prisma.Decimal) =>
    `${valor.gt(0) ? "+" : valor.lt(0) ? "−" : ""}${cantidad(valor.abs().toString(), unidad)}`;

  const resumen = [
    { etiqueta: `Stock al ${fecha(new Date(`${desde}T12:00:00.000Z`))}`, valor: cantidad(kardex.saldoInicial.toString(), unidad) },
    { etiqueta: "Entradas", valor: `+${cantidad(kardex.entradas.toString(), unidad)}` },
    { etiqueta: "Salidas", valor: `−${cantidad(kardex.salidas.toString(), unidad)}` },
    { etiqueta: `Stock al ${fecha(new Date(`${hasta}T12:00:00.000Z`))}`, valor: cantidad(kardex.saldoFinal.toString(), unidad) },
  ];

  return (
    <section>
      <Volver href={`/inventario${consultaSucursal}`}>Inventario</Volver>
      <EncabezadoPagina
        titulo={producto.nombre}
        descripcion={`Movimientos de stock en ${sucursal.nombre}. El saldo de cada fila es el stock que quedó después de ese movimiento.`}
        meta={producto.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
        acciones={
          <Link href={`/productos/${producto.id}`} className={clasesBoton("secundario")}>
            Editar producto
          </Link>
        }
      />

      <Tarjeta className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
            Stock actual
          </p>
          <p
            className={`cifras text-[24px] font-semibold tracking-[-0.02em] ${kardex.stockActual.lt(0) ? "text-peligro-tinta" : "text-tinta"}`}
          >
            {cantidad(kardex.stockActual.toString(), unidad)}
          </p>
        </div>
        <div className="cifras space-y-0.5 text-[12px] text-tinta-suave">
          <p>
            <span className="font-mono">{producto.idInterno}</span> · {producto.categoria.nombre}
          </p>
          <p>
            Mínimo {producto.stockMinimo ? cantidad(producto.stockMinimo.toString(), unidad) : "sin definir"}
            {" · "}último costo{" "}
            {producto.costoActual ? formatoMoneda(producto.costoActual) : "sin compras"}
          </p>
        </div>
      </Tarjeta>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        {opciones.length > 0 ? <input type="hidden" name="sucursal" value={sucursal.id} /> : null}
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
        <Boton type="submit">Filtrar</Boton>
      </form>

      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {resumen.map((r) => (
          <div key={r.etiqueta} className="rounded-lg border border-borde bg-superficie px-3.5 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
              {r.etiqueta}
            </dt>
            <dd className="cifras mt-0.5 text-[15px] font-medium text-tinta">{r.valor}</dd>
          </div>
        ))}
      </dl>

      {kardex.recortadoDesde ? (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2.5 text-[12px] text-alerta-tinta">
          <span className="mt-px shrink-0">
            <Icono nombre="alerta" tamano={14} />
          </span>
          El período tiene demasiados movimientos: se muestran desde el{" "}
          {formatoFechaHora(kardex.recortadoDesde)}. Acotá las fechas para ver el resto.
        </p>
      ) : null}

      <Tabla
        columnas={[
          { label: "Fecha" },
          { label: "Movimiento" },
          { label: "Referencia", ocultaMovil: true },
          { label: "Usuario", ocultaMovil: true },
          { label: "Cantidad", derecha: true },
          { label: "Saldo", derecha: true },
        ]}
      >
        <Fila atenuada>
          <Celda className="cifras whitespace-nowrap">
            {kardex.recortadoDesde
              ? formatoFechaHora(kardex.recortadoDesde)
              : fecha(new Date(`${desde}T12:00:00.000Z`))}
          </Celda>
          <Celda>Saldo inicial</Celda>
          <Celda ocultaMovil />
          <Celda ocultaMovil />
          <Celda />
          <Celda derecha className="cifras whitespace-nowrap font-medium">
            {cantidad(kardex.saldoInicial.toString(), unidad)}
          </Celda>
        </Fila>
        {kardex.movimientos.map((m) => {
          const tipo = TIPOS[m.tipo];
          return (
            <Fila key={m.clave}>
              <Celda className="cifras whitespace-nowrap text-tinta-media">
                {formatoFechaHora(m.fecha)}
              </Celda>
              <Celda>
                <Etiqueta tono={tipo.tono}>{tipo.label}</Etiqueta>
                {m.detalle ? (
                  <span className="mt-0.5 block max-w-xs truncate text-[11px] text-tinta-suave" title={m.detalle}>
                    {m.detalle}
                  </span>
                ) : null}
              </Celda>
              <Celda ocultaMovil className="whitespace-nowrap">
                {m.referencia.href ? (
                  <Link href={m.referencia.href} className="underline-offset-2 hover:underline">
                    {m.referencia.texto}
                  </Link>
                ) : (
                  <span className="text-tinta-media">{m.referencia.texto}</span>
                )}
              </Celda>
              <Celda ocultaMovil className="text-tinta-media">
                {m.usuario}
              </Celda>
              <Celda
                derecha
                className={`cifras whitespace-nowrap font-medium ${m.cantidad.lt(0) ? "text-peligro-tinta" : m.cantidad.gt(0) ? "text-exito-tinta" : "text-tinta-suave"}`}
              >
                {conSigno(m.cantidad)}
              </Celda>
              <Celda
                derecha
                className={`cifras whitespace-nowrap ${m.saldo.lt(0) ? "text-peligro-tinta" : ""}`}
              >
                {cantidad(m.saldo.toString(), unidad)}
              </Celda>
            </Fila>
          );
        })}
      </Tabla>

      {kardex.movimientos.length === 0 ? (
        <p className="mt-3 text-[12px] text-tinta-suave">Sin movimientos en el período.</p>
      ) : (
        <p className="mt-3 text-[12px] text-tinta-suave">
          {kardex.movimientos.length}{" "}
          {kardex.movimientos.length === 1 ? "movimiento" : "movimientos"}. Ventas y compras se
          ubican cuando tocaron el stock: una venta sin conexión, al sincronizarse; una compra, al
          registrarse.
        </p>
      )}
    </section>
  );
}
