"use client";

import type { MetodoPago, Prisma } from "@prisma/client";
import Link from "next/link";
import type { Ref } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT } from "@/components/ui/campo";
import { Icono } from "@/components/ui/icono";
import { formatoMoneda } from "@/lib/formato";

const METODOS: readonly { valor: MetodoPago; label: string }[] = [
  { valor: "EFECTIVO", label: "Efectivo" },
  { valor: "TRANSFERENCIA", label: "Transferencia" },
  { valor: "TARJETA", label: "Tarjeta" },
  { valor: "FIADO", label: "Fiado" },
];

export type EstadoCredito = {
  saldo: Prisma.Decimal;
  limite: Prisma.Decimal;
  exceso: Prisma.Decimal;
} | null;

export type ErrorCobro = { mensaje: string; sesionVencida?: boolean } | null;

/**
 * Total, método de pago y botón de cobro.
 *
 * El botón ignora Enter a propósito: si quedara enfocado, el Enter con el que
 * termina cada escaneo cobraría la venta. Se cobra con clic o con F4.
 */
export function PanelCobro({
  ref,
  refRecibido,
  refBoton,
  total,
  lineas,
  metodoPago,
  onMetodo,
  motivoSinFiado,
  recibido,
  onRecibido,
  vuelto,
  credito,
  esAdmin,
  motivoBloqueo,
  enviando,
  error,
  onCobrar,
}: {
  ref: Ref<HTMLDivElement>;
  refRecibido: Ref<HTMLInputElement>;
  refBoton: Ref<HTMLButtonElement>;
  total: Prisma.Decimal;
  lineas: number;
  metodoPago: MetodoPago;
  onMetodo: (metodo: MetodoPago) => void;
  /** Por qué no se puede vender fiado; `null` si se puede. */
  motivoSinFiado: string | null;
  recibido: string;
  onRecibido: (texto: string) => void;
  /** `null` si no se ingresó un monto recibido válido. */
  vuelto: Prisma.Decimal | null;
  /** Solo cuando la venta fiado supera el límite del cliente. */
  credito: EstadoCredito;
  esAdmin: boolean;
  motivoBloqueo: string | null;
  enviando: boolean;
  error: ErrorCobro;
  onCobrar: () => void;
}) {
  return (
    <div ref={ref} className="space-y-4 rounded-xl border border-borde bg-superficie px-4 py-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
            Total
          </p>
          <p className="text-[12px] text-tinta-media">
            {lineas} {lineas === 1 ? "línea" : "líneas"}
          </p>
        </div>
        <p className="cifras text-[34px] font-semibold leading-none tracking-[-0.02em] text-tinta">
          {formatoMoneda(total)}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
          Método de pago
        </p>
        <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-2 gap-1.5">
          {METODOS.map((metodo) => {
            const activo = metodo.valor === metodoPago;
            const bloqueado = metodo.valor === "FIADO" && motivoSinFiado !== null;

            return (
              <button
                key={metodo.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={bloqueado}
                onClick={() => onMetodo(metodo.valor)}
                title={bloqueado ? (motivoSinFiado ?? undefined) : undefined}
                className={[
                  "h-10 rounded-md border px-2 text-[13px] transition-colors duration-150",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                  activo && metodo.valor === "FIADO"
                    ? "border-alerta-tinta/30 bg-alerta-fondo font-medium text-alerta-tinta"
                    : activo
                      ? "border-marca-300 bg-marca-50 font-medium text-marca-700"
                      : "border-borde text-tinta-media hover:bg-superficie-suave hover:text-tinta",
                ].join(" ")}
              >
                {metodo.label}
              </button>
            );
          })}
        </div>
        {motivoSinFiado ? (
          <p className="mt-1.5 text-[11px] text-tinta-suave">Fiado: {motivoSinFiado}</p>
        ) : null}
      </div>

      {metodoPago === "EFECTIVO" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-tinta-media">Recibido</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
                L
              </span>
              <input
                ref={refRecibido}
                value={recibido}
                onChange={(evento) => onRecibido(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") evento.preventDefault();
                }}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                className={`cifras h-10 pl-7 text-right ${CLASES_INPUT}`}
              />
            </div>
          </label>
          <div>
            <span className="mb-1 block text-[12px] font-medium text-tinta-media">Vuelto</span>
            <p
              className={[
                "cifras flex h-10 items-center justify-end rounded-md px-3 text-[16px] font-semibold",
                vuelto === null
                  ? "bg-superficie-suave text-tinta-suave"
                  : vuelto.lt(0)
                    ? "bg-peligro-fondo text-peligro-tinta"
                    : "bg-exito-fondo text-exito-tinta",
              ].join(" ")}
            >
              {vuelto === null
                ? "—"
                : vuelto.lt(0)
                  ? `Faltan ${formatoMoneda(vuelto.abs())}`
                  : formatoMoneda(vuelto)}
            </p>
          </div>
        </div>
      ) : null}

      {metodoPago === "FIADO" && credito ? (
        <div
          className={[
            "rounded-lg px-3.5 py-3 text-[12px] leading-relaxed",
            esAdmin ? "bg-alerta-fondo text-alerta-tinta" : "bg-peligro-fondo text-peligro-tinta",
          ].join(" ")}
        >
          <p className="font-medium">
            Supera el límite de crédito por {formatoMoneda(credito.exceso)}
          </p>
          <p className="cifras">
            Saldo {formatoMoneda(credito.saldo)} · límite {formatoMoneda(credito.limite)}
          </p>
          <p className="mt-1">
            {esAdmin
              ? "Al cobrar se te va a pedir confirmación."
              : "No se puede cobrar fiado. Pedí autorización al administrador o elegí otro método."}
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-peligro-fondo px-3 py-2.5 text-[13px] leading-snug text-peligro-tinta"
        >
          <span className="mt-px shrink-0">
            <Icono nombre="alerta" tamano={15} />
          </span>
          <span>
            {error.mensaje}
            {error.sesionVencida ? (
              <>
                {" "}
                <Link href="/login" className="font-medium underline underline-offset-2">
                  Iniciar sesión
                </Link>
                . El carrito queda guardado.
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      <Boton
        ref={refBoton}
        variante="primario"
        tamano="lg"
        className="w-full justify-between"
        disabled={motivoBloqueo !== null || enviando}
        onClick={onCobrar}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") evento.preventDefault();
        }}
      >
        <span>{enviando ? "Registrando…" : "Cobrar"}</span>
        <span className="font-mono text-[12px] opacity-70">F4</span>
      </Boton>

      {motivoBloqueo && !enviando ? (
        <p className="-mt-2 text-center text-[12px] text-tinta-suave">{motivoBloqueo}</p>
      ) : null}
    </div>
  );
}
