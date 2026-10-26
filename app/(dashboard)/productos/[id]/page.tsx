import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
        descripcion="El stock no se edita acá: se mueve con compras y ventas."
        meta={producto.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
      />

      <FormularioProducto
        accion={guardarProducto.bind(null, producto.id)}
        esNuevo={false}
        categorias={categorias}
        proveedores={proveedores}
        inicial={{
          idInterno: producto.idInterno,
          codigoBarras: producto.codigoBarras ?? "",
          nombre: producto.nombre,
          categoriaId: producto.categoriaId,
          proveedorId: producto.proveedorId,
          unidadVenta: producto.unidadVenta,
          // Los precios son CLP: se muestran sin los ",00" del Decimal.
          precioMinorista: String(aNumero(producto.precioMinorista.toString())),
          precioMayorista: String(aNumero(producto.precioMayorista.toString())),
          fechaVencimiento: producto.fechaVencimiento
            ? fechaISO(producto.fechaVencimiento)
            : "",
          activo: producto.activo,
        }}
      />
    </section>
  );
}
