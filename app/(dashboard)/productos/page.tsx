import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { BarraFiltros } from "@/components/ui/filtros";
import { Icono } from "@/components/ui/icono";
import {
  AvisoGuardado,
  EncabezadoPagina,
  EstadoVacio,
  Pestanas,
} from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { DIAS_AVISO_VENCIMIENTO } from "@/lib/config";
import {
  aNumero,
  cantidad,
  diasHasta,
  fecha,
  formatoMoneda,
  sufijoUnidad,
} from "@/lib/formato";
import {
  filtroActivo,
  leerParametros,
  OPCIONES_ESTADO,
  type ParametrosBusqueda,
} from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { NuevoProducto } from "./_components/nuevo-producto";
import { opcionesProducto } from "./_components/opciones";
import { PESTANAS_PRODUCTOS } from "./_components/pestanas";

export const metadata: Metadata = {
  title: "Productos | Inversiones Ferrera",
};

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const parametros = await leerParametros(searchParams);
  const { q = "", categoria = "", estado = "" } = parametros;

  const where: Prisma.ProductoWhereInput = { ...filtroActivo(estado) };
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { codigoBarras: { contains: q } },
      // El ID interno se busca exacto: "10" no debería traer el 1001.
      ...(/^\d+$/.test(q) && Number(q) <= 2_147_483_647
        ? [{ idInterno: Number(q) }]
        : []),
    ];
  }
  if (/^\d+$/.test(categoria)) where.categoriaId = Number(categoria);

  const [productos, [categorias, proveedores], total, ultimo] = await Promise.all([
    prisma.producto.findMany({
      where,
      select: {
        id: true,
        idInterno: true,
        codigoBarras: true,
        nombre: true,
        unidadVenta: true,
        precioMinorista: true,
        precioMayorista: true,
        fechaVencimiento: true,
        activo: true,
        categoria: { select: { nombre: true } },
        stock: { select: { cantidad: true } },
      },
      orderBy: [{ nombre: "asc" }],
    }),
    // Las categorías sirven al filtro y al formulario del diálogo de alta.
    opcionesProducto(),
    prisma.producto.count(),
    prisma.producto.aggregate({ _max: { idInterno: true } }),
  ]);

  const filtrando = Boolean(q || categoria || estado);
  const alta = {
    siguienteIdInterno: (ultimo._max.idInterno ?? 1000) + 1,
    categorias,
    proveedores,
  };

  return (
    <section>
      <EncabezadoPagina
        titulo="Productos"
        descripcion="Catálogo, precios minorista y mayorista, y vencimientos. Lo inactivo no aparece en caja."
        acciones={<NuevoProducto {...alta} />}
      />

      <Pestanas items={PESTANAS_PRODUCTOS} activa="/productos" />

      <AvisoGuardado nombre={parametros.guardado} />

      {total === 0 ? (
        <EstadoVacio
          icono="productos"
          titulo="Todavía no hay productos"
          accion={<NuevoProducto {...alta} texto="Cargar el primero" />}
        >
          Sin productos no se puede vender ni comprar: es lo primero que hay que cargar.
        </EstadoVacio>
      ) : (
        <>
          <BarraFiltros
            placeholder="Buscar por nombre, ID interno o código de barras"
            valores={parametros}
            filtros={[
              {
                nombre: "categoria",
                etiqueta: "Categoría",
                opciones: [
                  { valor: "", label: "Todas las categorías" },
                  ...categorias.map((c) => ({ valor: String(c.id), label: c.nombre })),
                ],
              },
              { nombre: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO },
            ]}
          />

          {productos.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ningún producto coincide con la búsqueda{filtrando ? " y los filtros elegidos" : ""}.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                columnas={[
                  { label: "ID" },
                  { label: "Producto" },
                  { label: "Categoría", ocultaMovil: true },
                  { label: "Minorista", derecha: true },
                  { label: "Mayorista", derecha: true },
                  { label: "Stock", derecha: true, ocultaMovil: true },
                  { label: "Vence", ocultaMovil: true },
                  { label: "Acciones", derecha: true },
                ]}
              >
                {productos.map((producto) => {
                  const stock = producto.stock.reduce(
                    (suma, s) => suma + aNumero(s.cantidad.toString()),
                    0,
                  );

                  return (
                    <Fila key={producto.id} atenuada={!producto.activo}>
                      <Celda className="cifras font-mono text-[12px] text-tinta-media">
                        {producto.idInterno}
                      </Celda>
                      <Celda>
                        <Link
                          href={`/productos/${producto.id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {producto.nombre}
                        </Link>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-tinta-suave">
                          <span>por {sufijoUnidad(producto.unidadVenta)}</span>
                          {producto.codigoBarras ? (
                            <span className="cifras font-mono">{producto.codigoBarras}</span>
                          ) : null}
                          {producto.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
                        </span>
                      </Celda>
                      <Celda ocultaMovil className="text-tinta-media">
                        {producto.categoria.nombre}
                      </Celda>
                      <Celda derecha className="cifras">
                        {formatoMoneda(producto.precioMinorista.toString())}
                      </Celda>
                      <Celda derecha className="cifras text-tinta-media">
                        {formatoMoneda(producto.precioMayorista.toString())}
                      </Celda>
                      <Celda
                        derecha
                        ocultaMovil
                        className={`cifras ${stock <= 0 ? "text-peligro-tinta" : ""}`}
                      >
                        {cantidad(stock, producto.unidadVenta)}
                      </Celda>
                      <Celda ocultaMovil>
                        <Vencimiento fecha={producto.fechaVencimiento} />
                      </Celda>
                      <Celda derecha>
                        <Link
                          href={`/productos/${producto.id}`}
                          className={clasesBoton("fantasma", "sm")}
                          aria-label={`Editar ${producto.nombre}`}
                        >
                          <Icono nombre="editar" tamano={15} />
                          Editar
                        </Link>
                      </Celda>
                    </Fila>
                  );
                })}
              </Tabla>

              <p className="mt-3 text-[12px] text-tinta-suave">
                {productos.length} de {total} productos
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Vencimiento({ fecha: vence }: { fecha: Date | null }) {
  if (!vence) return <span className="text-tinta-suave">—</span>;

  const dias = diasHasta(vence);
  if (dias < 0) return <Etiqueta tono="peligro">Vencido</Etiqueta>;
  if (dias <= DIAS_AVISO_VENCIMIENTO) {
    return (
      <Etiqueta tono="alerta">{dias === 0 ? "Vence hoy" : `En ${dias} d`}</Etiqueta>
    );
  }
  return <span className="cifras text-tinta-media">{fecha(vence)}</span>;
}
