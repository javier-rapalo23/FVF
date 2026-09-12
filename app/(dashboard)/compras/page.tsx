import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Compras | Inversiones Ferrera",
};

export default function ComprasPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Compras"
        descripcion="Compras a proveedores e ingreso de mercadería. Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="compras"
        alcance={[
        "Registro de compras con detalle por producto y costo unitario.",
        "Ingreso de mercadería que suma al stock de la sucursal.",
        "Cargo automático en la cuenta del proveedor.",
        ]}
      />
    </section>
  );
}
