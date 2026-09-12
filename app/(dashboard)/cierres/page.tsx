import type { Metadata } from "next";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, ModuloPendiente } from "@/components/ui/pagina";

export const metadata: Metadata = {
  title: "Cierres de caja | Inversiones Ferrera",
};

export default function CierresPage() {
  return (
    <section>
      <EncabezadoPagina
        titulo="Cierres de caja"
        descripcion="Arqueo de caja al cierre del turno. El empleado registra, el administrador revisa."
        meta={<Etiqueta tono="alerta">En construcción</Etiqueta>}
      />

      <ModuloPendiente
        icono="cierres"
        alcance={[
        "Registrar el arqueo del turno: total del sistema, total contado y diferencia.",
        "Historial de cierres por sucursal y por usuario.",
        "Revisión del administrador sobre los cierres del empleado.",
        ]}
      />
    </section>
  );
}
