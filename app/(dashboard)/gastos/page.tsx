import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Gastos | Inversiones Ferrera",
};

export default function GastosPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Gastos"
        descripcion="Gastos operativos, de mercadería y administrativos. Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="gastos"
        alcance={[
        "Carga de gastos por categoría: operativo, mercadería o administrativo.",
        "Asignación por sucursal y usuario responsable.",
        "Impacto de los gastos en el resultado del período.",
        ]}
      />
    </section>
  );
}
