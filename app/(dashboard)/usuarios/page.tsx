import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Usuarios | Inversiones Ferrera",
};

export default function UsuariosPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Usuarios del sistema, roles y asignación de sucursal. Solo administrador."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="usuarios"
        alcance={[
        "Alta de usuarios con rol administrador o empleado de caja.",
        "Asignación de sucursal y baja lógica de cuentas.",
        "Restablecer la contraseña de un usuario.",
        ]}
      />
    </section>
  );
}
