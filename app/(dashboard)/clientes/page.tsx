import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Clientes | Inversiones Ferrera" };

export default function ClientesPage() {
  return (
    <PlaceholderModulo
      titulo="Clientes"
      descripcion="Clientes minoristas y mayoristas, con cuenta corriente (fiado). Solo administrador."
    />
  );
}
