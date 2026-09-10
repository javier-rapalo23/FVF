"use client";

import { useActionState } from "react";

import { autenticar, type EstadoLogin } from "./actions";

const ESTADO_INICIAL: EstadoLogin = { error: null };

export function LoginForm() {
  const [estado, formAction, pendiente] = useActionState(
    autenticar,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
        />
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-md bg-marca-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-marca-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
