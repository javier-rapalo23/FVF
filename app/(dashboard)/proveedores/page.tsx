import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Proveedores | Inversiones Ferrera" };

export default function ProveedoresPage() {
  return (
    <PlaceholderModulo
      titulo="Proveedores"
      descripcion="Proveedores y cuentas por pagar. Solo administrador."
    />
  );
}
