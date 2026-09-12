import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Proveedores | Inversiones Ferrera",
};

export default function ProveedoresPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion="Proveedores y cuentas por pagar. Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="proveedores"
        alcance={[
        "Ficha del proveedor y productos que provee.",
        "Cuenta por pagar: cargos por compra y pagos registrados.",
        "Saldo pendiente por proveedor.",
        ]}
      />
    </section>
  );
}
