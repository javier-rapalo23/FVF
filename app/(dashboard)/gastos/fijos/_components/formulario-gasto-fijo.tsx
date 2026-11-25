"use client";

import type { MedioPagoGasto } from "@prisma/client";
import { useState } from "react";

import { CLASES_INPUT, Campo, CampoSelect, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";
import {
  CATEGORIAS_GASTO,
  DIA_MAXIMO_GASTO_FIJO,
  MAXIMO_DESCRIPCION,
  MEDIOS_GASTO,
  NOMBRE_CATEGORIA,
  NOMBRE_MEDIO,
} from "@/lib/gastos/tipos";

import type { ConceptoOpcion } from "../../_components/formulario-gasto";

type Sucursal = { id: number; nombre: string };

export type ValoresGastoFijo = {
  conceptoId: number | null;
  descripcion: string;
  montoEstimado: string;
  diaDelMes: string;
  medioPago: MedioPagoGasto | "";
  sucursalId: number | null;
  activo: boolean;
};

export function FormularioGastoFijo({
  accion,
  esNuevo,
  conceptos,
  sucursales,
  inicial,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  esNuevo: boolean;
  conceptos: readonly ConceptoOpcion[];
  sucursales: readonly Sucursal[];
  inicial: ValoresGastoFijo;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const { errores } = estado;
  const [medio, setMedio] = useState<MedioPagoGasto | "">(inicial.medioPago);
  const deCaja = medio === "EFECTIVO_CAJA";

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario
          titulo="Qué se paga"
          descripcion="La descripción y el monto se cargan solos al registrar el gasto del mes. El monto real se puede cambiar en ese momento."
        >
          <div className="sm:col-span-2">
            <CampoSelect
              id="conceptoId"
              name="conceptoId"
              etiqueta="Concepto"
              defaultValue={inicial.conceptoId ?? ""}
              autoFocus={esNuevo}
              error={errores.conceptoId}
            >
              <option value="">Elegí un concepto</option>
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
              placeholder="Ej.: Alquiler del local, planilla quincenal"
              defaultValue={inicial.descripcion}
              maxLength={MAXIMO_DESCRIPCION}
              required
              error={errores.descripcion}
            />
          </div>

          <GrupoCampo etiqueta="Monto estimado" htmlFor="montoEstimado" error={errores.montoEstimado}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
                L
              </span>
              <input
                id="montoEstimado"
                name="montoEstimado"
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                defaultValue={inicial.montoEstimado}
                aria-invalid={errores.montoEstimado ? true : undefined}
                aria-describedby={errores.montoEstimado ? "montoEstimado-error" : undefined}
                className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
              />
            </div>
          </GrupoCampo>

          <Campo
            id="diaDelMes"
            name="diaDelMes"
            type="number"
            inputMode="numeric"
            etiqueta="Día de pago"
            min={1}
            max={DIA_MAXIMO_GASTO_FIJO}
            step={1}
            defaultValue={inicial.diaDelMes}
            ayuda={`Del 1 al ${DIA_MAXIMO_GASTO_FIJO}. Pasado ese día sin registrarlo, figura como atrasado.`}
            error={errores.diaDelMes}
            className="cifras"
          />
        </SeccionFormulario>

        <SeccionFormulario titulo="Cómo se paga">
          <CampoSelect
            id="medioPago"
            name="medioPago"
            etiqueta="Medio de pago"
            value={medio}
            onChange={(evento) => setMedio(evento.target.value as MedioPagoGasto | "")}
            error={errores.medioPago}
          >
            <option value="">Elegí cómo se paga</option>
            {MEDIOS_GASTO.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MEDIO[m]}
              </option>
            ))}
          </CampoSelect>

          {sucursales.length > 0 ? (
            <CampoSelect
              id="sucursalId"
              name="sucursalId"
              etiqueta={deCaja ? "Caja de la sucursal" : "Sucursal"}
              defaultValue={inicial.sucursalId ?? (sucursales.length === 1 && deCaja ? sucursales[0]!.id : "")}
              error={errores.sucursalId}
              ayuda={
                deCaja
                  ? "Al registrarlo, sale de esta caja y se descuenta en su próximo cierre."
                  : "Sin sucursal, el gasto es general de la empresa."
              }
            >
              <option value="">{deCaja ? "Elegí la sucursal" : "General (sin sucursal)"}</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </CampoSelect>
          ) : null}

          {esNuevo ? null : (
            <label className="flex items-center gap-2 text-[13px] text-tinta-media sm:col-span-2">
              <input
                type="checkbox"
                name="activo"
                value="si"
                defaultChecked={inicial.activo}
                className="h-4 w-4 accent-marca-600"
              />
              Activo: desactivado deja de figurar en el resumen, pero sus gastos se conservan.
            </label>
          )}
        </SeccionFormulario>

        <PieFormulario
          volverA="/gastos/fijos"
          pendiente={pendiente}
          textoEnviar={esNuevo ? "Crear gasto fijo" : "Guardar cambios"}
        />
      </div>
    </form>
  );
}
