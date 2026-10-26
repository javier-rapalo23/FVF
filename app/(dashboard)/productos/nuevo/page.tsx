import type { Metadata } from "next";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { prisma } from "@/lib/prisma";

import { guardarProducto } from "../actions";
import { FormularioProducto } from "../_components/formulario-producto";
import { opcionesProducto } from "../_components/opciones";

export const metadata: Metadata = {
  title: "Nuevo producto | Inversiones Ferrera",
};

export default async function NuevoProductoPage() {
  const [[categorias, proveedores], ultimo] = await Promise.all([
    opcionesProducto(),
    prisma.producto.aggregate({ _max: { idInterno: true } }),
  ]);

  return (
    <section>
      <Volver href="/productos">Productos</Volver>
      <EncabezadoPagina
        titulo="Nuevo producto"
        descripcion="El ID interno se propone correlativo al último cargado; se puede cambiar."
      />

      <FormularioProducto
        accion={guardarProducto.bind(null, null)}
        esNuevo
        categorias={categorias}
        proveedores={proveedores}
        inicial={{
          idInterno: (ultimo._max.idInterno ?? 1000) + 1,
          codigoBarras: "",
          nombre: "",
          categoriaId: null,
          proveedorId: null,
          unidadVenta: "UNIDAD",
          precioMinorista: "",
          precioMayorista: "",
          fechaVencimiento: "",
          activo: true,
        }}
      />
    </section>
  );
}
