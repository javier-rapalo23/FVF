import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Caja / Ventas | Inversiones Ferrera" };

export default function CajaPage() {
  return (
    <PlaceholderModulo
      titulo="Caja / Ventas"
      descripcion="Registro de ventas en local y pedidos. Accesible para administrador y empleado de caja."
    />
  );
}
