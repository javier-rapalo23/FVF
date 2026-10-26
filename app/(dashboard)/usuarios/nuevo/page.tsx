import type { Metadata } from "next";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { prisma } from "@/lib/prisma";

import { guardarUsuario } from "../actions";
import { FormularioUsuario } from "../_components/formulario-usuario";

export const metadata: Metadata = {
  title: "Nuevo usuario | Inversiones Ferrera",
};

export default async function NuevoUsuarioPage() {
  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <section>
      <Volver href="/usuarios">Usuarios</Volver>
      <EncabezadoPagina titulo="Nuevo usuario" />

      <FormularioUsuario
        accion={guardarUsuario.bind(null, null)}
        esNuevo
        esPropio={false}
        sucursales={sucursales}
        inicial={{
          nombre: "",
          email: "",
          rol: "EMPLEADO_CAJA",
          // Con una sola sucursal (el MVP), se preselecciona.
          sucursalId: sucursales.length === 1 ? sucursales[0]!.id : null,
          activo: true,
        }}
      />
    </section>
  );
}
