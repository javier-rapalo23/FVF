import type { Metadata } from "next";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";

import { guardarProveedor } from "../actions";
import { FormularioProveedor } from "../_components/formulario-proveedor";

export const metadata: Metadata = {
  title: "Nuevo proveedor | Inversiones Ferrera",
};

export default function NuevoProveedorPage() {
  return (
    <section>
      <Volver href="/proveedores">Proveedores</Volver>
      <EncabezadoPagina titulo="Nuevo proveedor" />

      <FormularioProveedor
        accion={guardarProveedor.bind(null, null)}
        esNuevo
        inicial={{ nombre: "", telefono: "", activo: true }}
      />
    </section>
  );
}
