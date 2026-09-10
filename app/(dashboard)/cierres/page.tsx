import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Cierres de caja | Inversiones Ferrera" };

export default function CierresPage() {
  return (
    <PlaceholderModulo
      titulo="Cierres de caja"
      descripcion="Arqueo de caja al cierre del turno. El empleado registra, el administrador revisa."
    />
  );
}
