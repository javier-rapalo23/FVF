import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Compras | Inversiones Ferrera" };

export default function ComprasPage() {
  return (
    <PlaceholderModulo
      titulo="Compras"
      descripcion="Compras a proveedores e ingreso de mercadería. Solo administrador."
    />
  );
}
