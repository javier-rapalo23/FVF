import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Reportes | Inversiones Ferrera",
};

export default function ReportesPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Reportes de ventas, márgenes, stock y cuentas. Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="reportes"
        alcance={[
        "Ventas por período, canal, método de pago y sucursal.",
        "Márgenes por producto y categoría, comparando precio contra costo.",
        "Estado de stock, cuentas por cobrar y cuentas por pagar.",
        ]}
      />
    </section>
  );
}
