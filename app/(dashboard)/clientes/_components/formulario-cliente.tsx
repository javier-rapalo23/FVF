"use client";

import type { TipoCliente } from "@prisma/client";
import { useState } from "react";

import { CLASES_INPUT, Campo, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { Segmentado } from "@/components/ui/segmentado";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";

export type ClienteFormulario = {
  nombre: string;
  telefono: string;
  tipo: TipoCliente;
  fiadoHabilitado: boolean;
  limiteCredito: string;
  activo: boolean;
};

export function FormularioCliente({
  accion,
  inicial,
  esNuevo,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  inicial: ClienteFormulario;
  esNuevo: boolean;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const [tipo, setTipo] = useState<TipoCliente>(inicial.tipo);
  const [activo, setActivo] = useState(inicial.activo ? "si" : "no");
  const [fiado, setFiado] = useState(inicial.fiadoHabilitado ? "si" : "no");
  const [limite, setLimite] = useState(inicial.limiteCredito);
  const { errores } = estado;

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario titulo="Datos del cliente">
          <div className="sm:col-span-2">
            <Campo
              id="nombre"
              name="nombre"
              etiqueta="Nombre o razón social"
              defaultValue={inicial.nombre}
              maxLength={120}
              required
              autoFocus={esNuevo}
              error={errores.nombre}
            />
          </div>
          <Campo
            id="telefono"
            name="telefono"
            etiqueta="Teléfono"
            type="tel"
            defaultValue={inicial.telefono}
            placeholder="+56 9 1234 5678"
            maxLength={30}
            error={errores.telefono}
          />
        </SeccionFormulario>

        <SeccionFormulario
          titulo="Condiciones comerciales"
          descripcion="El tipo define la lista de precios que la caja aplica al elegir al cliente."
        >
          <div className="sm:col-span-2">
            <GrupoCampo
              etiqueta="Tipo de cliente"
              error={errores.tipo}
              ayuda={
                tipo === "MAYORISTA"
                  ? "Paga precio mayorista."
                  : "Paga precio minorista."
              }
            >
              <Segmentado
                etiqueta="Tipo de cliente"
                name="tipo"
                valor={tipo}
                onCambio={setTipo}
                opciones={[
                  { valor: "MINORISTA", label: "Minorista" },
                  { valor: "MAYORISTA", label: "Mayorista" },
                ]}
              />
            </GrupoCampo>
          </div>
          <GrupoCampo
            etiqueta="Fiado"
            ayuda={
              fiado === "si"
                ? "Puede llevar mercadería a cuenta corriente."
                : "Solo puede pagar en el momento."
            }
          >
            <Segmentado
              etiqueta="Fiado"
              name="fiadoHabilitado"
              valor={fiado}
              onCambio={setFiado}
              opciones={[
                { valor: "no", label: "No habilitado" },
                { valor: "si", label: "Habilitado" },
              ]}
            />
          </GrupoCampo>

          {fiado === "si" ? (
            <GrupoCampo
              etiqueta="Límite de crédito"
              htmlFor="limiteCredito"
              error={errores.limiteCredito}
              ayuda="Deuda máxima permitida. Vacío: sin tope."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
                  $
                </span>
                <input
                  id="limiteCredito"
                  name="limiteCredito"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={limite}
                  onChange={(evento) => setLimite(evento.target.value)}
                  placeholder="Sin tope"
                  aria-invalid={errores.limiteCredito ? true : undefined}
                  className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
                />
              </div>
            </GrupoCampo>
          ) : (
            // Con el fiado apagado, el límite se conserva para cuando se reactive.
            <input type="hidden" name="limiteCredito" value={limite} />
          )}

          {esNuevo ? null : (
            <GrupoCampo
              etiqueta="Estado"
              ayuda={
                activo === "si"
                  ? "Se puede elegir en caja."
                  : "No aparece en caja. Conserva su historial y su cuenta."
              }
            >
              <Segmentado
                etiqueta="Estado del cliente"
                name="activo"
                valor={activo}
                onCambio={setActivo}
                opciones={[
                  { valor: "si", label: "Activo" },
                  { valor: "no", label: "Inactivo" },
                ]}
              />
            </GrupoCampo>
          )}
        </SeccionFormulario>

        <PieFormulario
          volverA="/clientes"
          pendiente={pendiente}
          textoEnviar={esNuevo ? "Crear cliente" : "Guardar cambios"}
        />
      </div>
    </form>
  );
}
