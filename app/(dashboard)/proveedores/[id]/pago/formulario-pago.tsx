"use client";

import type { MedioPagoProveedor } from "@prisma/client";
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
import { aDecimal } from "@/lib/calculos";
import {
  MAXIMO_NOTA_CUENTA,
  MEDIOS_PAGO_PROVEEDOR,
  NOMBRE_MEDIO_PAGO_PROVEEDOR,
} from "@/lib/cuentas/tipos";
import { formatoMoneda } from "@/lib/formato";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";

type Sucursal = { id: number; nombre: string };

export function FormularioPago({
  accion,
  claveIdempotencia,
  saldo,
  sucursalPropia,
  sucursales,
  esperados,
  volverA,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  claveIdempotencia: string;
  /** Saldo por pagar: tope del pago. */
  saldo: string;
  sucursalPropia: Sucursal | null;
  /** Para elegir la caja; vacía si el usuario tiene sucursal propia. */
  sucursales: readonly Sucursal[];
  /** Efectivo esperado ahora en cada caja, para avisar si el pago lo supera. */
  esperados: Readonly<Record<number, string>>;
  volverA: string;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const { errores } = estado;

  // Sin valor por defecto: un pago de caja cambia el cierre, se elige a conciencia.
  const [medio, setMedio] = useState<MedioPagoProveedor | "">("");
  const [monto, setMonto] = useState("");
  const [sucursalId, setSucursalId] = useState(() => {
    if (sucursalPropia) return String(sucursalPropia.id);
    return sucursales.length === 1 ? String(sucursales[0]!.id) : "";
  });

  const deCaja = medio === "EFECTIVO_CAJA";
  const eligeSucursal = deCaja && !sucursalPropia && sucursales.length > 1;
  const nombreCaja =
    sucursalPropia?.nombre ?? sucursales.find((s) => String(s.id) === sucursalId)?.nombre ?? null;

  const esperado = deCaja && sucursalId ? (esperados[Number(sucursalId)] ?? null) : null;
  const superaEsperado = (() => {
    if (!esperado || !monto) return false;
    try {
      return aDecimal(monto).gt(esperado);
    } catch {
      return false;
    }
  })();

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <input type="hidden" name="claveIdempotencia" value={claveIdempotencia} />
      {deCaja && !eligeSucursal && sucursalId ? (
        <input type="hidden" name="sucursalId" value={sucursalId} />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario
          titulo="Pago"
          descripcion={`Se le deben ${formatoMoneda(saldo)}. El pago no puede ser mayor.`}
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
                  max={saldo}
                  step={0.01}
                  value={monto}
                  onChange={(evento) => setMonto(evento.target.value)}
                  autoFocus
                  aria-invalid={errores.monto ? true : undefined}
                  aria-describedby={errores.monto ? "monto-error" : undefined}
                  className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
                />
              </div>
              <Boton className="h-10 shrink-0" onClick={() => setMonto(saldo)} title="Pagar todo el saldo">
                Todo
              </Boton>
            </div>
          </GrupoCampo>

          <CampoSelect
            id="medioPago"
            name="medioPago"
            etiqueta="Medio de pago"
            value={medio}
            onChange={(evento) => setMedio(evento.target.value as MedioPagoProveedor | "")}
            error={errores.medioPago}
          >
            <option value="">Elegí cómo se pagó</option>
            {MEDIOS_PAGO_PROVEEDOR.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MEDIO_PAGO_PROVEEDOR[m]}
              </option>
            ))}
          </CampoSelect>

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

          {medio ? (
            <div className="sm:col-span-2">
              {deCaja ? (
                <p className="flex items-start gap-2 rounded-md bg-info-fondo px-3 py-2.5 text-[13px] leading-snug text-info-tinta">
                  <span className="mt-px shrink-0">
                    <Icono nombre="caja" tamano={15} />
                  </span>
                  <span>
                    Sale del cajón{nombreCaja ? ` de ${nombreCaja}` : ""} y se descuenta en el próximo
                    cierre de caja.
                  </span>
                </p>
              ) : (
                <p className="text-[12px] text-tinta-suave">
                  No sale del cajón de ventas: no cambia ningún cierre de caja.
                </p>
              )}
              {!eligeSucursal && errores.sucursalId ? (
                <p className="mt-1.5 text-xs text-peligro-tinta">{errores.sucursalId}</p>
              ) : null}
              {superaEsperado && esperado ? (
                <p className="mt-2 flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2.5 text-[13px] leading-snug text-alerta-tinta">
                  <span className="mt-px shrink-0">
                    <Icono nombre="alerta" tamano={15} />
                  </span>
                  Es más que el efectivo que debería haber ahora en la caja ({formatoMoneda(esperado)}).
                  Se puede guardar igual; revisá el monto.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Campo
              id="nota"
              name="nota"
              etiqueta="Nota (opcional)"
              placeholder="Ej.: abono factura 0012, N° de transferencia"
              maxLength={MAXIMO_NOTA_CUENTA}
              error={errores.nota}
            />
          </div>
        </SeccionFormulario>

        <PieFormulario volverA={volverA} pendiente={pendiente} textoEnviar="Registrar pago" />
      </div>
    </form>
  );
}
