import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Gastos | Inversiones Ferrera" };

export default function GastosPage() {
  return (
    <PlaceholderModulo
      titulo="Gastos"
      descripcion="Gastos operativos, de mercadería y administrativos. Solo administrador."
    />
  );
}
