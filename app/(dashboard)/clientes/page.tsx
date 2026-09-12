import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Clientes | Inversiones Ferrera",
};

export default function ClientesPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Clientes minoristas y mayoristas, con cuenta corriente (fiado). Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="clientes"
        alcance={[
        "Ficha de cliente minorista o mayorista, con teléfono y límite de crédito.",
        "Cuenta corriente: cargos por fiado y abonos, con saldo al día.",
        "Historial de compras de cada cliente.",
        ]}
      />
    </section>
  );
}
