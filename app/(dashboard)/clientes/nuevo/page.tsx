import type { Metadata } from "next";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";

import { guardarCliente } from "../actions";
import { FormularioCliente } from "../_components/formulario-cliente";

export const metadata: Metadata = {
  title: "Nuevo cliente | Inversiones Ferrera",
};

export default function NuevoClientePage() {
  return (
    <section>
      <Volver href="/clientes">Clientes</Volver>
      <EncabezadoPagina titulo="Nuevo cliente" />

      <FormularioCliente
        accion={guardarCliente.bind(null, null)}
        esNuevo
        inicial={{
          nombre: "",
          telefono: "",
          tipo: "MINORISTA",
          fiadoHabilitado: false,
          limiteCredito: "",
          activo: true,
        }}
      />
    </section>
  );
}
