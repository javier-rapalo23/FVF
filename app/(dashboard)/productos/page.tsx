import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Productos | Inversiones Ferrera",
};

export default function ProductosPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Productos"
        descripcion="Alta y mantenimiento de productos, precios minorista/mayorista y stock. Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="productos"
        alcance={[
        "Alta y edición de productos con ID interno, código de barras y categoría.",
        "Precio minorista y mayorista, y unidad de venta: peso, unidad o paquete.",
        "Stock por sucursal y control de fecha de vencimiento.",
        ]}
      />
    </section>
  );
}
