import type { Metadata } from "next";

import { EncabezadoPagina, Volver } from "@/components/ui/pagina";

import { guardarGastoFijoAccion } from "../../actions";
import { FormularioGastoFijo } from "../_components/formulario-gasto-fijo";
import { opcionesGastoFijo } from "../_components/opciones";

export const metadata: Metadata = { title: "Nuevo gasto fijo | Inversiones Ferrera" };

/** Solo administrador: la ruta tiene su propio permiso en `lib/permissions.ts`. */
export default async function NuevoGastoFijoPage() {
  const [conceptos, sucursales] = await opcionesGastoFijo();

  return (
    <section>
      <Volver href="/gastos/fijos">Gastos fijos</Volver>
      <EncabezadoPagina
        titulo="Nuevo gasto fijo"
        descripcion="Un recordatorio de lo que se paga todos los meses. No registra nada solo: el resumen avisa cuándo falta registrarlo."
      />
      <FormularioGastoFijo
        accion={guardarGastoFijoAccion.bind(null, null)}
        esNuevo
        conceptos={conceptos}
        sucursales={sucursales}
        inicial={{
          conceptoId: null,
          descripcion: "",
          montoEstimado: "",
          diaDelMes: "",
          medioPago: "",
          sucursalId: null,
          activo: true,
        }}
      />
    </section>
  );
}
