"use client";

import { Campo, CampoSelect } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";
import {
  CATEGORIAS_GASTO,
  MAXIMO_COMPROBANTE,
  MAXIMO_DESCRIPCION,
  NOMBRE_CATEGORIA,
} from "@/lib/gastos/tipos";

import type { ConceptoOpcion } from "./formulario-gasto";

/**
 * Corrección de los datos que no mueven dinero. El monto, el medio, la
 * sucursal y la fecha no se editan: se anula y se registra de nuevo.
 */
export function CorregirGasto({
  accion,
  conceptos,
  inicial,
  volverA,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  conceptos: readonly ConceptoOpcion[];
  inicial: { conceptoId: number; descripcion: string; numeroComprobante: string };
  volverA: string;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const { errores } = estado;

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario
          titulo="Datos descriptivos"
          descripcion="Para cambiar el monto, el medio, la sucursal o la fecha, anulá el gasto y registralo de nuevo."
        >
          <div className="sm:col-span-2">
            <CampoSelect
              id="conceptoId"
              name="conceptoId"
              etiqueta="Concepto"
              defaultValue={inicial.conceptoId}
              error={errores.conceptoId}
            >
              {CATEGORIAS_GASTO.map((categoria) => {
                const delGrupo = conceptos.filter((c) => c.categoria === categoria);
                if (delGrupo.length === 0) return null;
                return (
                  <optgroup key={categoria} label={NOMBRE_CATEGORIA[categoria]}>
                    {delGrupo.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </CampoSelect>
          </div>
          <div className="sm:col-span-2">
            <Campo
              id="descripcion"
              name="descripcion"
              etiqueta="Descripción"
              defaultValue={inicial.descripcion}
              maxLength={MAXIMO_DESCRIPCION}
              required
              error={errores.descripcion}
            />
          </div>
          <Campo
            id="numeroComprobante"
            name="numeroComprobante"
            etiqueta="N° de comprobante (opcional)"
            defaultValue={inicial.numeroComprobante}
            maxLength={MAXIMO_COMPROBANTE}
            error={errores.numeroComprobante}
          />
        </SeccionFormulario>

        <PieFormulario volverA={volverA} pendiente={pendiente} textoEnviar="Guardar cambios" />
      </div>
    </form>
  );
}
