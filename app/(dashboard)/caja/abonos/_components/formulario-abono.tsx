"use client";

import type { MedioAbono } from "@prisma/client";
import { useState } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, Campo, CampoSelect, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Segmentado } from "@/components/ui/segmentado";
import { MAXIMO_NOTA_CUENTA, MEDIOS_ABONO, NOMBRE_MEDIO_ABONO } from "@/lib/cuentas/tipos";
import { formatoMoneda } from "@/lib/formato";
import { FORMULARIO_INICIAL } from "@/lib/formulario";

import { registrarAbonoAccion } from "../actions";

export type ClienteConSaldo = { id: number; nombre: string; saldo: string };
type Sucursal = { id: number; nombre: string };

export function FormularioAbono({
  claveIdempotencia,
  clientes,
  clienteInicial,
  sucursalPropia,
  sucursales,
  volverA,
}: {
  claveIdempotencia: string;
  /** Solo los que deben algo. */
  clientes: readonly ClienteConSaldo[];
  clienteInicial: number | null;
  /** Sucursal asignada al usuario: es la caja que recibe el efectivo. */
  sucursalPropia: Sucursal | null;
  /** Para elegir la caja; vacía si el usuario no elige sucursal. */
  sucursales: readonly Sucursal[];
  volverA: string;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(registrarAbonoAccion, FORMULARIO_INICIAL);
  const { errores } = estado;

  const [clienteId, setClienteId] = useState(clienteInicial ? String(clienteInicial) : "");
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<MedioAbono>("EFECTIVO");
  const [sucursalId, setSucursalId] = useState(() => {
    if (sucursalPropia) return String(sucursalPropia.id);
    return sucursales.length === 1 ? String(sucursales[0]!.id) : "";
  });

  const cliente = clientes.find((c) => String(c.id) === clienteId) ?? null;
  const efectivo = medio === "EFECTIVO";
  const eligeSucursal = efectivo && !sucursalPropia && sucursales.length > 1;
  const nombreCaja =
    sucursalPropia?.nombre ?? sucursales.find((s) => String(s.id) === sucursalId)?.nombre ?? null;

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <input type="hidden" name="claveIdempotencia" value={claveIdempotencia} />
      {efectivo && !eligeSucursal && sucursalId ? (
        <input type="hidden" name="sucursalId" value={sucursalId} />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario
          titulo="Cliente"
          descripcion="Solo aparecen los clientes que deben algo de su cuenta de fiado."
        >
          <div className="sm:col-span-2">
            <CampoSelect
              id="clienteId"
              name="clienteId"
              etiqueta="Cliente"
              value={clienteId}
              onChange={(evento) => {
                setClienteId(evento.target.value);
                setMonto("");
              }}
              autoFocus={!clienteInicial}
              error={errores.clienteId}
              ayuda={
                cliente ? (
                  <>
                    Debe <span className="cifras font-medium text-tinta">{formatoMoneda(cliente.saldo)}</span>.
                  </>
                ) : undefined
              }
            >
              <option value="">Elegí el cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · debe {formatoMoneda(c.saldo)}
                </option>
              ))}
            </CampoSelect>
          </div>
        </SeccionFormulario>

        <SeccionFormulario
          titulo="Abono"
          descripcion="No puede ser mayor que lo que debe el cliente."
        >
          <GrupoCampo etiqueta="Monto" htmlFor="monto" error={errores.monto}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
                  L
                </span>
                <input
                  id="monto"
                  name="monto"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={cliente?.saldo}
                  step={0.01}
                  value={monto}
                  onChange={(evento) => setMonto(evento.target.value)}
                  autoFocus={Boolean(clienteInicial)}
                  aria-invalid={errores.monto ? true : undefined}
                  aria-describedby={errores.monto ? "monto-error" : undefined}
                  className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
                />
              </div>
              <Boton
                className="h-10 shrink-0"
                disabled={!cliente}
                onClick={() => cliente && setMonto(cliente.saldo)}
                title="Cargar todo lo que debe"
              >
                Todo
              </Boton>
            </div>
          </GrupoCampo>

          <GrupoCampo etiqueta="Medio de pago" error={errores.medioPago}>
            <Segmentado
              etiqueta="Medio de pago"
              name="medioPago"
              valor={medio}
              onCambio={setMedio}
              opciones={MEDIOS_ABONO.map((m) => ({ valor: m, label: NOMBRE_MEDIO_ABONO[m] }))}
            />
          </GrupoCampo>

          {eligeSucursal ? (
            <CampoSelect
              id="sucursalId"
              name="sucursalId"
              etiqueta="Caja de la sucursal"
              value={sucursalId}
              onChange={(evento) => setSucursalId(evento.target.value)}
              error={errores.sucursalId}
            >
              <option value="">Elegí la sucursal</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </CampoSelect>
          ) : null}

          <div className="sm:col-span-2">
            {efectivo ? (
              <p className="flex items-start gap-2 rounded-md bg-info-fondo px-3 py-2.5 text-[13px] leading-snug text-info-tinta">
                <span className="mt-px shrink-0">
                  <Icono nombre="caja" tamano={15} />
                </span>
                <span>
                  Entra al cajón{nombreCaja ? ` de ${nombreCaja}` : ""} y suma en el próximo cierre de
                  caja.
                </span>
              </p>
            ) : (
              <p className="text-[12px] text-tinta-suave">
                No entra al cajón: no cambia el efectivo del cierre.
              </p>
            )}
            {!eligeSucursal && errores.sucursalId ? (
              <p className="mt-1.5 text-xs text-peligro-tinta">{errores.sucursalId}</p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Campo
              id="nota"
              name="nota"
              etiqueta="Nota (opcional)"
              placeholder="Ej.: abono de la quincena, N° de transferencia"
              maxLength={MAXIMO_NOTA_CUENTA}
              error={errores.nota}
            />
          </div>
        </SeccionFormulario>

        <PieFormulario volverA={volverA} pendiente={pendiente} textoEnviar="Registrar abono" />
      </div>
    </form>
  );
}
