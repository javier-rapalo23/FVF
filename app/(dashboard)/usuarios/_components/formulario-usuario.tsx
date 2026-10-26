"use client";

import type { Rol } from "@prisma/client";
import { useState } from "react";

import { Campo, CampoSelect, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { Segmentado } from "@/components/ui/segmentado";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";

export type UsuarioFormulario = {
  nombre: string;
  email: string;
  rol: Rol;
  sucursalId: number | null;
  activo: boolean;
};

export function FormularioUsuario({
  accion,
  inicial,
  sucursales,
  esNuevo,
  esPropio,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  inicial: UsuarioFormulario;
  sucursales: readonly { id: number; nombre: string }[];
  esNuevo: boolean;
  /** El administrador editando su propio usuario: no puede degradarse ni desactivarse. */
  esPropio: boolean;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const [rol, setRol] = useState<Rol>(inicial.rol);
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

        <SeccionFormulario titulo="Cuenta" descripcion="Con el email y la contraseña se inicia sesión.">
          <div className="sm:col-span-2">
            <Campo
              id="nombre"
              name="nombre"
              etiqueta="Nombre"
              defaultValue={inicial.nombre}
              maxLength={120}
              required
              autoFocus={esNuevo}
              error={errores.nombre}
            />
          </div>
          <Campo
            id="email"
            name="email"
            etiqueta="Email"
            type="email"
            defaultValue={inicial.email}
            placeholder="nombre@ferrera.com"
            autoComplete="off"
            maxLength={120}
            required
            error={errores.email}
          />
          <Campo
            id="password"
            name="password"
            etiqueta={esNuevo ? "Contraseña" : "Nueva contraseña"}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required={esNuevo}
            placeholder={esNuevo ? undefined : "Sin cambios"}
            error={errores.password}
            ayuda={
              esNuevo
                ? "Mínimo 8 caracteres."
                : "Dejala vacía para mantener la actual."
            }
          />
        </SeccionFormulario>

        <SeccionFormulario
          titulo="Acceso"
          descripcion={
            esNuevo
              ? undefined
              : esPropio
                ? "Si cambiás tu sucursal, vas a tener que volver a ingresar."
                : "Si le cambiás el rol o la sucursal, o lo desactivás, su sesión abierta se cierra y tiene que volver a ingresar."
          }
        >
          <div className="sm:col-span-2">
            <GrupoCampo
              etiqueta="Rol"
              error={errores.rol}
              ayuda={
                esPropio
                  ? "No podés cambiar tu propio rol."
                  : rol === "ADMINISTRADOR"
                    ? "Acceso a todos los módulos."
                    : "Solo caja y cierres de caja."
              }
            >
              <Segmentado
                etiqueta="Rol"
                name="rol"
                valor={rol}
                onCambio={(valor) => {
                  if (!esPropio) setRol(valor);
                }}
                opciones={[
                  { valor: "EMPLEADO_CAJA", label: "Empleado de caja" },
                  { valor: "ADMINISTRADOR", label: "Administrador" },
                ]}
              />
            </GrupoCampo>
          </div>

          <CampoSelect
            id="sucursalId"
            name="sucursalId"
            etiqueta="Sucursal"
            defaultValue={inicial.sucursalId ?? ""}
            error={errores.sucursalId}
            ayuda={
              rol === "EMPLEADO_CAJA"
                ? "Obligatoria: la caja descuenta el stock de esta sucursal."
                : "Opcional para administradores."
            }
          >
            <option value="">Sin sucursal</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </CampoSelect>

          {esNuevo ? null : (
            <GrupoCampo
              etiqueta="Estado"
              ayuda={
                esPropio
                  ? "No podés desactivar tu propio usuario."
                  : activo === "si"
                    ? "Puede iniciar sesión."
                    : "No puede iniciar sesión. Conserva su historial."
              }
            >
              <Segmentado
                etiqueta="Estado del usuario"
                name="activo"
                valor={activo}
                onCambio={(valor) => {
                  if (!esPropio) setActivo(valor);
                }}
                opciones={[
                  { valor: "si", label: "Activo" },
                  { valor: "no", label: "Inactivo" },
                ]}
              />
            </GrupoCampo>
          )}
        </SeccionFormulario>

        <PieFormulario
          volverA="/usuarios"
          pendiente={pendiente}
          textoEnviar={esNuevo ? "Crear usuario" : "Guardar cambios"}
        />
      </div>
    </form>
  );
}
