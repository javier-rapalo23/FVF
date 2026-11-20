"use client";

import type { CategoriaGasto, MedioPagoGasto } from "@prisma/client";
import { useState } from "react";

import { CLASES_INPUT, Campo, CampoSelect, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { aDecimal } from "@/lib/calculos";
import { formatoMoneda } from "@/lib/formato";
import { FORMULARIO_INICIAL } from "@/lib/formulario";
import {
  CATEGORIAS_GASTO,
  MAXIMO_COMPROBANTE,
  MAXIMO_DESCRIPCION,
  MEDIOS_GASTO,
  NOMBRE_CATEGORIA,
  NOMBRE_MEDIO,
} from "@/lib/gastos/tipos";

import { registrarGastoAccion } from "../actions";

export type ConceptoOpcion = { id: number; nombre: string; categoria: CategoriaGasto };
type Sucursal = { id: number; nombre: string };

export function FormularioGasto({
  claveIdempotencia,
  conceptos,
  esAdmin,
  sucursalPropia,
  sucursales,
  esperados,
  hoy,
  diaMinimo,
}: {
  claveIdempotencia: string;
  conceptos: readonly ConceptoOpcion[];
  esAdmin: boolean;
  /** Sucursal asignada al usuario: fija la caja de la que sale el efectivo. */
  sucursalPropia: Sucursal | null;
  /** Para elegir; vacía si el usuario no elige sucursal. */
  sucursales: readonly Sucursal[];
  /**
   * Efectivo esperado ahora en cada caja, para avisar si un gasto lo supera.
   * Solo llega al administrador: al empleado le revelaría el esperado del cierre.
   */
  esperados: Readonly<Record<number, string>> | null;
  hoy: string;
  diaMinimo: string;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(registrarGastoAccion, FORMULARIO_INICIAL);
  const { errores } = estado;

  // El empleado solo registra gastos de caja. El administrador elige el medio a
  // conciencia: un gasto de caja cambia el cierre, así que no hay valor por defecto.
  const [medio, setMedio] = useState<MedioPagoGasto | "">(esAdmin ? "" : "EFECTIVO_CAJA");
  const [conceptoId, setConceptoId] = useState("");
  const [monto, setMonto] = useState("");
  const [sucursalId, setSucursalId] = useState(
    sucursalPropia ? String(sucursalPropia.id) : sucursales.length === 1 ? String(sucursales[0]!.id) : "",
  );

  const deCaja = medio === "EFECTIVO_CAJA";
  // Caja con sucursal propia: no se elige. Otro medio: el administrador elige (o ninguna).
  const eligeSucursal = esAdmin && sucursales.length > 0 && !(deCaja && sucursalPropia);
  const concepto = conceptos.find((c) => String(c.id) === conceptoId);

  const esperado =
    deCaja && esperados && sucursalId ? esperados[Number(sucursalId)] ?? null : null;
  const superaEsperado = (() => {
    if (!esperado || !monto) return false;
    try {
      return aDecimal(monto.replace(",", ".")).gt(esperado);
    } catch {
      return false;
    }
  })();

  const nombreSucursalCaja =
    sucursalPropia?.nombre ?? sucursales.find((s) => String(s.id) === sucursalId)?.nombre ?? null;

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <input type="hidden" name="claveIdempotencia" value={claveIdempotencia} />
      {esAdmin ? null : <input type="hidden" name="medioPago" value="EFECTIVO_CAJA" />}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario titulo="Qué se pagó">
          <div className="sm:col-span-2">
            <CampoSelect
              id="conceptoId"
              name="conceptoId"
              etiqueta="Concepto"
              value={conceptoId}
              onChange={(evento) => setConceptoId(evento.target.value)}
              autoFocus
              error={errores.conceptoId}
              ayuda={
                concepto?.categoria === "MERCADERIA"
                  ? "Solo lo que no entra al stock (fletes, bolsas, hielo). La mercadería que se vende se registra en Compras."
                  : concepto
                    ? `Categoría: ${NOMBRE_CATEGORIA[concepto.categoria]}.`
                    : undefined
              }
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

          <GrupoCampo etiqueta="Monto" htmlFor="monto" error={errores.monto}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
                L
              </span>
              <input
                id="monto"
                name="monto"
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                aria-invalid={errores.monto ? true : undefined}
                aria-describedby={errores.monto ? "monto-error" : undefined}
                className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
              />
            </div>
          </GrupoCampo>

          <Campo
            id="numeroComprobante"
            name="numeroComprobante"
            etiqueta="N° de comprobante (opcional)"
            placeholder="Factura o recibo"
            maxLength={MAXIMO_COMPROBANTE}
            error={errores.numeroComprobante}
          />

          <div className="sm:col-span-2">
            <Campo
              id="descripcion"
              name="descripcion"
              etiqueta="Descripción"
              placeholder="Ej.: Recibo ENEE octubre, flete de Comayagua"
              maxLength={MAXIMO_DESCRIPCION}
              required
              error={errores.descripcion}
            />
          </div>
        </SeccionFormulario>

        <SeccionFormulario
          titulo="Cómo se pagó"
          descripcion={
            esAdmin
              ? "Solo el efectivo de caja sale del cajón de ventas y se descuenta en el cierre."
              : "Registrá acá lo que pagaste con el efectivo de la caja. Se descuenta en el próximo cierre."
          }
        >
          {esAdmin ? (
            <CampoSelect
              id="medioPago"
              name="medioPago"
              etiqueta="Medio de pago"
              value={medio}
              onChange={(evento) => setMedio(evento.target.value as MedioPagoGasto | "")}
              error={errores.medioPago}
            >
              <option value="">Elegí cómo se pagó</option>
              {MEDIOS_GASTO.map((m) => (
                <option key={m} value={m}>
                  {NOMBRE_MEDIO[m]}
                </option>
              ))}
            </CampoSelect>
          ) : null}

          {eligeSucursal ? (
            <CampoSelect
              id="sucursalId"
              name="sucursalId"
              etiqueta={deCaja ? "Caja de la sucursal" : "Sucursal"}
              value={sucursalId}
              onChange={(evento) => setSucursalId(evento.target.value)}
              error={errores.sucursalId}
              ayuda={deCaja ? undefined : "Sin sucursal, el gasto es general de la empresa."}
            >
              <option value="">{deCaja ? "Elegí la sucursal" : "General (sin sucursal)"}</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </CampoSelect>
          ) : null}

          {deCaja ? (
            <div className="sm:col-span-2">
              <p className="flex items-start gap-2 rounded-md bg-info-fondo px-3 py-2.5 text-[13px] leading-snug text-info-tinta">
                <span className="mt-px shrink-0">
                  <Icono nombre="caja" tamano={15} />
                </span>
                <span>
                  Efectivo de caja{nombreSucursalCaja ? ` · ${nombreSucursalCaja}` : ""} · hoy. Se
                  descuenta en el próximo cierre de caja.
                </span>
              </p>
              {errores.fecha ? <p className="mt-1.5 text-xs text-peligro-tinta">{errores.fecha}</p> : null}
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
          ) : medio ? (
            <Campo
              id="fecha"
              name="fecha"
              type="date"
              etiqueta="Fecha del pago"
              defaultValue={hoy}
              min={diaMinimo}
              max={hoy}
              error={errores.fecha}
            />
          ) : null}
        </SeccionFormulario>

        <PieFormulario volverA="/gastos" pendiente={pendiente} textoEnviar="Registrar gasto" />
      </div>
    </form>
  );
}
