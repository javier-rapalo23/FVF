import type { Metadata } from "next";

import { Icono } from "@/components/ui/icono";
import { Marca } from "@/components/ui/marca";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar | Inversiones Ferrera",
};

const CAPACIDADES = [
  "Venta minorista y mayorista en local y por pedido",
  "Cuentas corrientes de clientes y saldos con proveedores",
  "Cierres de caja, gastos y reportes por sucursal",
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/*
        Panel de identidad en carbón, no en verde: un bloque grande de color de
        marca ensucia la paleta y el verde queda reservado para la acción.
      */}
      <section className="relative hidden w-[46%] max-w-2xl flex-col justify-between bg-carbon p-12 lg:flex">
        <div aria-hidden className="trama-lineas absolute inset-0" />

        <div className="relative">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-marca-500 text-white">
              <Icono nombre="tienda" tamano={17} />
            </span>
            <span className="leading-none">
              <span className="block text-[9px] font-medium uppercase tracking-[0.14em] text-white/45">
                Inversiones
              </span>
              <span className="mt-1 block text-[15px] font-semibold tracking-[-0.01em] text-white">
                Ferrera
              </span>
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
            Punto de venta y gestión para la verdulería.
          </h2>

          <ul className="mt-8 space-y-3">
            {CAPACIDADES.map((capacidad) => (
              <li
                key={capacidad}
                className="flex items-start gap-3 text-[13px] leading-relaxed text-white/60"
              >
                <span className="mt-0.5 shrink-0 text-marca-400">
                  <Icono nombre="check" tamano={14} />
                </span>
                {capacidad}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-white/30">
          Local Principal · Av. Principal 123
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Marca />
          </div>

          <header className="mb-7 mt-8 space-y-1.5 lg:mt-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-tinta">
              Ingresar
            </h1>
            <p className="text-[13px] text-tinta-media">
              Usá tu cuenta del sistema para entrar a la caja.
            </p>
          </header>

          <LoginForm />

          {/*
            Las credenciales del seed solo se muestran fuera de producción:
            son datos de prueba, no una ayuda para el local.
          */}
          {process.env.NODE_ENV !== "production" ? (
            <div className="mt-7 rounded-lg border border-borde bg-superficie-suave px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Datos de prueba
              </p>
              <dl className="mt-2 space-y-1 font-mono text-[11px] text-tinta-media">
                <div className="flex justify-between gap-4">
                  <dt>admin@ferrera.com</dt>
                  <dd className="text-tinta-suave">ferrera123</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>caja@ferrera.com</dt>
                  <dd className="text-tinta-suave">ferrera123</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
