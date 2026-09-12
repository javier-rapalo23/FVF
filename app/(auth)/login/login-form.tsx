"use client";

import { useActionState } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Icono } from "@/components/ui/icono";

import { autenticar, type EstadoLogin } from "./actions";

const ESTADO_INICIAL: EstadoLogin = { error: null };

export function LoginForm() {
  const [estado, formAction, pendiente] = useActionState(
    autenticar,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Campo
        id="email"
        name="email"
        type="email"
        etiqueta="Email"
        placeholder="nombre@ferrera.com"
        required
        autoComplete="email"
        autoFocus
      />

      <Campo
        id="password"
        name="password"
        type="password"
        etiqueta="Contraseña"
        required
        autoComplete="current-password"
      />

      {estado.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-peligro-fondo px-3 py-2.5 text-[13px] leading-snug text-peligro-tinta"
        >
          <span className="mt-px shrink-0">
            <Icono nombre="alerta" tamano={15} />
          </span>
          {estado.error}
        </p>
      ) : null}

      <Boton
        type="submit"
        variante="primario"
        tamano="lg"
        disabled={pendiente}
        className="w-full"
      >
        {pendiente ? "Ingresando…" : "Ingresar"}
      </Boton>
    </form>
  );
}
