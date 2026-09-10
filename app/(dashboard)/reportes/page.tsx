import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Reportes | Inversiones Ferrera" };

export default function ReportesPage() {
  return (
    <PlaceholderModulo
      titulo="Reportes"
      descripcion="Reportes de ventas, márgenes, stock y cuentas. Solo administrador."
    />
  );
}
