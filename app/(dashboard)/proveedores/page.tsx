import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { BarraFiltros } from "@/components/ui/filtros";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, EncabezadoPagina, EstadoVacio } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import {
  filtroActivo,
  leerParametros,
  OPCIONES_ESTADO,
  type ParametrosBusqueda,
} from "@/lib/listados";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Proveedores | Inversiones Ferrera",
};

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const parametros = await leerParametros(searchParams);
  const { q = "", estado = "" } = parametros;

  const where: Prisma.ProveedorWhereInput = { ...filtroActivo(estado) };
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q } },
    ];
  }

  const [proveedores, total] = await Promise.all([
    prisma.proveedor.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        telefono: true,
        activo: true,
        _count: { select: { productos: true, compras: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.proveedor.count(),
  ]);

  return (
    <section>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion="A quién se le compra la mercadería. Las compras y la cuenta por pagar se cargan en sus propios módulos."
        acciones={
          <Link href="/proveedores/nuevo" className={clasesBoton("primario")}>
            <Icono nombre="mas" tamano={16} />
            Nuevo proveedor
          </Link>
        }
      />

      <AvisoGuardado nombre={parametros.guardado} />

      {total === 0 ? (
        <EstadoVacio
          icono="proveedores"
          titulo="Todavía no hay proveedores"
          accion={
            <Link href="/proveedores/nuevo" className={clasesBoton("primario")}>
              Cargar el primero
            </Link>
          }
        >
          Hace falta al menos uno para registrar compras de mercadería.
        </EstadoVacio>
      ) : (
        <>
          <BarraFiltros
            placeholder="Buscar por nombre o teléfono"
            valores={parametros}
            filtros={[{ nombre: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO }]}
          />

          {proveedores.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ningún proveedor coincide con la búsqueda.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                columnas={[
                  { label: "Proveedor" },
                  { label: "Teléfono" },
                  { label: "Productos", derecha: true, ocultaMovil: true },
                  { label: "Compras", derecha: true, ocultaMovil: true },
                ]}
              >
                {proveedores.map((proveedor) => (
                  <Fila key={proveedor.id} atenuada={!proveedor.activo}>
                    <Celda>
                      <Link
                        href={`/proveedores/${proveedor.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {proveedor.nombre}
                      </Link>
                      {proveedor.activo ? null : (
                        <Etiqueta className="ml-2">Inactivo</Etiqueta>
                      )}
                    </Celda>
                    <Celda className="cifras text-tinta-media">
                      {proveedor.telefono ?? "—"}
                    </Celda>
                    <Celda derecha ocultaMovil className="cifras text-tinta-media">
                      {proveedor._count.productos}
                    </Celda>
                    <Celda derecha ocultaMovil className="cifras text-tinta-media">
                      {proveedor._count.compras}
                    </Celda>
                  </Fila>
                ))}
              </Tabla>

              <p className="mt-3 text-[12px] text-tinta-suave">
                {proveedores.length} de {total} proveedores
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
