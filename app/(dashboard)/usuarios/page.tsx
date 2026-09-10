import type { Metadata } from "next";

import { PlaceholderModulo } from "../_components/placeholder-modulo";

export const metadata: Metadata = { title: "Usuarios | Inversiones Ferrera" };

export default function UsuariosPage() {
  return (
    <PlaceholderModulo
      titulo="Usuarios"
      descripcion="Usuarios del sistema, roles y asignación de sucursal. Solo administrador."
    />
  );
}
