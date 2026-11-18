import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { aNumero, fechaISO } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import { guardarProducto } from "../actions";
import { FormularioProducto } from "../_components/formulario-producto";
import { opcionesProducto } from "../_components/opciones";

export const metadata: Metadata = {
  title: "Editar producto | Inversiones Ferrera",
};

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) notFound();

  const [categorias, proveedores] = await opcionesProducto(producto.proveedorId);

  return (
    <section>
      <Volver href="/productos">Productos</Volver>
      <EncabezadoPagina
        titulo={producto.nombre}
        descripcion="El stock y el costo no se editan acá: se mueven con compras, ventas y ajustes de inventario."
        acciones={
          <Link href={`/inventario/${producto.id}`} className={clasesBoton("secundario")}>
            Historial de stock
          </Link>
        }
        meta={producto.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
      />

      <FormularioProducto
        accion={guardarProducto.bind(null, producto.id)}
        esNuevo={false}
        costoActual={producto.costoActual?.toFixed(2) ?? null}
        categorias={categorias}
        proveedores={proveedores}
        inicial={{
          idInterno: producto.idInterno,
          codigoBarras: producto.codigoBarras ?? "",
          nombre: producto.nombre,
          categoriaId: producto.categoriaId,
          proveedorId: producto.proveedorId,
          unidadVenta: producto.unidadVenta,
          // Sin ceros de relleno: "18.5" en vez de "18.50" en el input.
          precioMinorista: String(aNumero(producto.precioMinorista.toString())),
          precioMayorista: String(aNumero(producto.precioMayorista.toString())),
          fechaVencimiento: producto.fechaVencimiento
            ? fechaISO(producto.fechaVencimiento)
            : "",
          stockMinimo: producto.stockMinimo === null ? "" : String(aNumero(producto.stockMinimo.toString())),
          activo: producto.activo,
        }}
      />
    </section>
  );
}
