import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { BarraFiltros } from "@/components/ui/filtros";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, EncabezadoPagina, EstadoVacio } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { precio } from "@/lib/formato";
import {
  filtroActivo,
  leerParametros,
  OPCIONES_ESTADO,
  type ParametrosBusqueda,
} from "@/lib/listados";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Clientes | Inversiones Ferrera",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const parametros = await leerParametros(searchParams);
  const { q = "", tipo = "", estado = "" } = parametros;

  const where: Prisma.ClienteWhereInput = { ...filtroActivo(estado) };
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q } },
    ];
  }
  if (tipo === "MINORISTA" || tipo === "MAYORISTA") where.tipo = tipo;

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        telefono: true,
        tipo: true,
        fiadoHabilitado: true,
        limiteCredito: true,
        activo: true,
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.count(),
  ]);

  return (
    <section>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Clientes minoristas y mayoristas, con su límite de crédito para ventas al fiado."
        acciones={
          <Link href="/clientes/nuevo" className={clasesBoton("primario")}>
            <Icono nombre="mas" tamano={16} />
            Nuevo cliente
          </Link>
        }
      />

      <AvisoGuardado nombre={parametros.guardado} />

      {total === 0 ? (
        <EstadoVacio
          icono="clientes"
          titulo="Todavía no hay clientes"
          accion={
            <Link href="/clientes/nuevo" className={clasesBoton("primario")}>
              Cargar el primero
            </Link>
          }
        >
          Para vender al por mayor o al fiado, el cliente tiene que estar cargado.
        </EstadoVacio>
      ) : (
        <>
          <BarraFiltros
            placeholder="Buscar por nombre o teléfono"
            valores={parametros}
            filtros={[
              {
                nombre: "tipo",
                etiqueta: "Tipo",
                opciones: [
                  { valor: "", label: "Todos los tipos" },
                  { valor: "MINORISTA", label: "Minoristas" },
                  { valor: "MAYORISTA", label: "Mayoristas" },
                ],
              },
              { nombre: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO },
            ]}
          />

          {clientes.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ningún cliente coincide con la búsqueda.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                columnas={[
                  { label: "Cliente" },
                  { label: "Tipo" },
                  { label: "Teléfono", ocultaMovil: true },
                  { label: "Fiado", derecha: true },
                ]}
              >
                {clientes.map((cliente) => (
                  <Fila key={cliente.id} atenuada={!cliente.activo}>
                    <Celda>
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {cliente.nombre}
                      </Link>
                      {cliente.activo ? null : (
                        <Etiqueta className="ml-2">Inactivo</Etiqueta>
                      )}
                    </Celda>
                    <Celda>
                      <Etiqueta tono={cliente.tipo === "MAYORISTA" ? "info" : "neutro"}>
                        {cliente.tipo === "MAYORISTA" ? "Mayorista" : "Minorista"}
                      </Etiqueta>
                    </Celda>
                    <Celda ocultaMovil className="cifras text-tinta-media">
                      {cliente.telefono ?? "—"}
                    </Celda>
                    <Celda derecha className="cifras">
                      {!cliente.fiadoHabilitado ? (
                        <span className="text-tinta-suave">No</span>
                      ) : cliente.limiteCredito === null ? (
                        "Sin tope"
                      ) : (
                        `Hasta ${precio(cliente.limiteCredito.toString())}`
                      )}
                    </Celda>
                  </Fila>
                ))}
              </Tabla>

              <p className="mt-3 text-[12px] text-tinta-suave">
                {clientes.length} de {total} clientes
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
