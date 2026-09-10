import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Productos | Inversiones Ferrera" };

export default function ProductosPage() {
  return (
    <PlaceholderModulo
      titulo="Productos"
      descripcion="Alta y mantenimiento de productos, precios minorista/mayorista y stock. Solo administrador."
    />
  );
}
