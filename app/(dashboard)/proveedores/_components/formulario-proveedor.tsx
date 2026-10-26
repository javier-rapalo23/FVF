"use client";

import { useState } from "react";

import { Campo, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { Segmentado } from "@/components/ui/segmentado";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";

export type ProveedorFormulario = { nombre: string; telefono: string; activo: boolean };

export function FormularioProveedor({
  accion,
  inicial,
  esNuevo,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  inicial: ProveedorFormulario;
  esNuevo: boolean;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const [activo, setActivo] = useState(inicial.activo ? "si" : "no");
  const { errores } = estado;

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario titulo="Datos del proveedor">
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
            placeholder="+504 9876-5432"
            maxLength={30}
            error={errores.telefono}
          />

          {esNuevo ? null : (
            <GrupoCampo
              etiqueta="Estado"
              ayuda={
                activo === "si"
                  ? "Disponible para compras y productos."
                  : "No se ofrece en compras ni productos. Conserva su historial y su cuenta."
              }
            >
              <Segmentado
                etiqueta="Estado del proveedor"
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
          volverA="/proveedores"
          pendiente={pendiente}
          textoEnviar={esNuevo ? "Crear proveedor" : "Guardar cambios"}
        />
      </div>
    </form>
  );
}
