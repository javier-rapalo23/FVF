"use client";

import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Tarjeta } from "@/components/ui/pagina";
import { Segmentado } from "@/components/ui/segmentado";
import { aDecimal, validarMontoNoNegativo } from "@/lib/calculos";
import type { Denominacion, TotalesCierre } from "@/lib/cierres/tipos";
import { DENOMINACIONES, DIFERENCIA_CIERRE_NOTA } from "@/lib/config";
import { formatoFechaHora } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import { contarPendientes } from "@/lib/offline/cola";
import { escuchar } from "@/lib/offline/eventos";
import { nuevaClave } from "@/lib/texto";

import { registrarCierreAccion, vistaPreviaCierreAccion } from "../actions";

/** Lo que la pantalla sabe antes de contar. El esperado solo llega al administrador. */
export type ResumenPrevio = {
  cantidadVentas: number;
  ventasTransferencia: string;
  ventasTarjeta: string;
  ventasFiado: string;
  efectivo: { ventasEfectivo: string; devolucionesEfectivo: string } | null;
};

type Paso = "contar" | "confirmar" | "listo";
type Resultado = Extract<Awaited<ReturnType<typeof registrarCierreAccion>>, { ok: true }>;

const PIEZAS_VACIAS = Object.fromEntries(DENOMINACIONES.map((d) => [d, ""])) as Record<
  Denominacion,
  string
>;

function etiquetaDenominacion(d: Denominacion): string {
  const valor = Number(d);
  return valor >= 1 ? `L ${valor}` : `${Math.round(valor * 100)} ctvs`;
}

/** Cantidad de piezas: entero no negativo; vacío es 0. */
function piezas(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "") return 0;
  return /^\d{1,6}$/.test(limpio) ? Number(limpio) : null;
}

export function FormularioCierre({
  sucursal,
  enviarSucursal,
  cierreAnterior,
  desde,
  resumen,
}: {
  sucursal: { id: number; nombre: string };
  /** El administrador sin sucursal manda cuál cierra. */
  enviarSucursal: boolean;
  cierreAnterior: { id: number; fecha: string; fondoSiguiente: string } | null;
  desde: string;
  resumen: ResumenPrevio;
}) {
  const [clave] = useState(nuevaClave);
  const [paso, setPaso] = useState<Paso>("contar");
  const [modo, setModo] = useState<"detalle" | "total">("detalle");
  const [cantidades, setCantidades] = useState<Record<Denominacion, string>>(PIEZAS_VACIAS);
  const [totalTexto, setTotalTexto] = useState("");
  const [fondoInicialTexto, setFondoInicialTexto] = useState("");
  const [fondoSiguienteTexto, setFondoSiguienteTexto] = useState(
    cierreAnterior ? String(aDecimal(cierreAnterior.fondoSiguiente).toNumber()) : "",
  );
  const [notas, setNotas] = useState("");
  const [previa, setPrevia] = useState<TotalesCierre | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<{ mensaje: string; recargar?: boolean } | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [enLinea, setEnLinea] = useState(true);
  const [ocupado, startTransition] = useTransition();

  // Bloqueos: ventas sin sincronizar en este equipo y conexión.
  useEffect(() => {
    setEnLinea(navigator.onLine);
    void contarPendientes().then(setPendientes);
    const sinRed = () => setEnLinea(false);
    const conRed = () => setEnLinea(true);
    window.addEventListener("offline", sinRed);
    window.addEventListener("online", conRed);
    const dejar = escuchar((evento) => {
      if (evento.tipo === "cola") void contarPendientes().then(setPendientes);
      if (evento.tipo === "red") setEnLinea(evento.enLinea);
    });
    return () => {
      window.removeEventListener("offline", sinRed);
      window.removeEventListener("online", conRed);
      dejar();
    };
  }, []);

  const bloqueado = pendientes > 0 || !enLinea;

  // ---- Conteo
  const piezasPorDenominacion = DENOMINACIONES.map((d) => ({ d, n: piezas(cantidades[d]) }));
  const piezasInvalidas = piezasPorDenominacion.filter((p) => p.n === null).map((p) => p.d);
  const contadoDetalle = piezasPorDenominacion.reduce(
    (suma, p) => (p.n ? suma.plus(aDecimal(p.d).mul(p.n)) : suma),
    aDecimal(0),
  );
  const totalValidado = validarMontoNoNegativo(totalTexto.replace(",", "."));
  const contado =
    modo === "detalle"
      ? piezasInvalidas.length === 0
        ? contadoDetalle
        : null
      : totalTexto.trim() && totalValidado.valido
        ? totalValidado.monto
        : null;

  function validarConteo(): string | null {
    if (!cierreAnterior) {
      const fondo = validarMontoNoNegativo(fondoInicialTexto.replace(",", "."));
      if (!fondoInicialTexto.trim() || !fondo.valido) {
        return "Escribí con cuánto efectivo arrancó la caja (puede ser 0).";
      }
    }
    if (modo === "detalle" && piezasInvalidas.length > 0) {
      return `Revisá la cantidad de ${etiquetaDenominacion(piezasInvalidas[0]!)}: tiene que ser un número entero.`;
    }
    if (contado === null) return "Escribí el total contado.";
    const fondo = validarMontoNoNegativo(fondoSiguienteTexto.replace(",", "."));
    if (!fondoSiguienteTexto.trim() || !fondo.valido) {
      return "Escribí cuánto efectivo queda en la caja para el turno siguiente (puede ser 0).";
    }
    if (fondo.monto.gt(contado)) return "El fondo que queda no puede ser mayor que lo contado.";
    return null;
  }

  const datosBase = {
    sucursalId: enviarSucursal ? sucursal.id : null,
    cierreAnteriorId: cierreAnterior?.id ?? null,
    fondoInicial: cierreAnterior ? null : fondoInicialTexto.trim().replace(",", "."),
  };

  function manejarError(r: { codigo: string; mensaje: string }) {
    setError({ mensaje: r.mensaje, recargar: r.codigo === "CIERRE_DESACTUALIZADO" });
  }

  function continuar() {
    const problema = validarConteo();
    if (problema) {
      setError({ mensaje: problema });
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const r = await vistaPreviaCierreAccion(datosBase);
        if (!r.ok) return manejarError(r);
        setPrevia(r.totales);
        setPaso("confirmar");
      } catch {
        setError({ mensaje: "Sin conexión con el servidor. Probá de nuevo en un momento." });
      }
    });
  }

  const esperado = previa ? aDecimal(previa.esperado) : null;
  const diferencia = esperado && contado ? contado.minus(esperado) : null;
  const fondoSiguiente = validarMontoNoNegativo(fondoSiguienteTexto.replace(",", "."));
  const retiro =
    contado && fondoSiguiente.valido ? contado.minus(fondoSiguiente.monto) : null;
  const notaObligatoria = diferencia !== null && diferencia.abs().gt(DIFERENCIA_CIERRE_NOTA);

  function confirmar() {
    if (notaObligatoria && !notas.trim()) {
      setError({ mensaje: "La diferencia es grande: explicala en la nota (o volvé a contar)." });
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const r = await registrarCierreAccion({
          ...datosBase,
          claveIdempotencia: clave,
          totalContado: (contado ?? aDecimal(0)).toFixed(2),
          detalleConteo:
            modo === "detalle"
              ? Object.fromEntries(
                  piezasPorDenominacion.filter((p) => p.n).map((p) => [p.d, p.n]),
                )
              : null,
          fondoSiguiente: fondoSiguienteTexto.trim().replace(",", "."),
          notas: notas.trim() || null,
        });
        if (!r.ok) return manejarError(r);
        setResultado(r);
        setPaso("listo");
      } catch {
        setError({
          mensaje:
            "Sin conexión con el servidor. Volvé a confirmar: si el cierre ya se guardó, no se duplica.",
        });
      }
    });
  }

  // ------------------------------------------------------------ Pantallas

  if (paso === "listo" && resultado) {
    const dif = aDecimal(resultado.diferencia);
    return (
      <Tarjeta className="max-w-xl px-6 py-6">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-tinta">
          <span className="text-exito-tinta">
            <Icono nombre="check" tamano={18} />
          </span>
          Cierre N° {resultado.cierreId} registrado
        </p>
        <dl className="cifras mt-4 space-y-1.5 text-[13px]">
          <FilaMonto etiqueta="Esperado" valor={resultado.totales.esperado} />
          <FilaMonto etiqueta="Contado" valor={resultado.totalContado} />
          <FilaMonto etiqueta={nombreDiferencia(dif)} valor={resultado.diferencia} tono={tonoDiferencia(dif)} />
          <FilaMonto etiqueta="Queda en la caja" valor={resultado.fondoSiguiente} />
          <FilaMonto etiqueta="Retiro" valor={resultado.retiro} fuerte />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/cierres/${resultado.cierreId}`} className={clasesBoton("primario")}>
            Ver el cierre
          </Link>
          <Link href="/caja" className={clasesBoton("secundario")}>
            Volver a la caja
          </Link>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-4">
        {pendientes > 0 ? (
          <Bloqueo>
            Este equipo tiene {pendientes} {pendientes === 1 ? "venta" : "ventas"} sin sincronizar.
            Esperá a que suban (o sincronizalas ahora) antes de cerrar: si no, ese efectivo quedaría
            fuera del cierre.{" "}
            <Link href="/caja/pendientes" className="font-medium underline underline-offset-2">
              Ver ventas sin sincronizar
            </Link>
          </Bloqueo>
        ) : null}
        {!enLinea ? <Bloqueo>Sin conexión: el cierre necesita el servidor.</Bloqueo> : null}

        {error ? (
          <div className="space-y-2">
            <AlertaFormulario mensaje={error.mensaje} />
            {error.recargar ? (
              <Boton onClick={() => window.location.reload()}>Recargar</Boton>
            ) : null}
          </div>
        ) : null}

        {paso === "contar" ? (
          <Tarjeta className="space-y-5 px-5 py-5">
            {cierreAnterior ? null : (
              <GrupoCampo
                etiqueta="Fondo inicial"
                htmlFor="fondo-inicial"
                ayuda="Es el primer cierre de esta caja: ¿con cuánto efectivo arrancó hoy?"
              >
                <CampoMonto id="fondo-inicial" valor={fondoInicialTexto} onCambio={setFondoInicialTexto} />
              </GrupoCampo>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-tinta-media">Efectivo contado en el cajón</p>
                <Segmentado
                  etiqueta="Forma de contar"
                  valor={modo}
                  onCambio={setModo}
                  opciones={[
                    { valor: "detalle", label: "Billetes y monedas" },
                    { valor: "total", label: "Solo el total" },
                  ]}
                />
              </div>

              {modo === "detalle" ? (
                <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {DENOMINACIONES.map((d) => {
                    const n = piezas(cantidades[d]);
                    return (
                      <label key={d} className="flex items-center gap-3">
                        <span className="cifras w-16 shrink-0 text-[13px] text-tinta-media">
                          {etiquetaDenominacion(d)}
                        </span>
                        <span className="text-[12px] text-tinta-suave">×</span>
                        <input
                          value={cantidades[d]}
                          onChange={(e) => setCantidades((c) => ({ ...c, [d]: e.target.value }))}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          aria-label={`Cantidad de ${etiquetaDenominacion(d)}`}
                          aria-invalid={n === null ? true : undefined}
                          className={`cifras h-8 w-20 text-right text-[13px] ${CLASES_INPUT}`}
                        />
                        <span className="cifras ml-auto text-[12px] text-tinta-suave">
                          {n ? formatoMoneda(aDecimal(d).mul(n)) : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <CampoMonto id="total-contado" valor={totalTexto} onCambio={setTotalTexto} autoFocus />
              )}

              <p className="cifras flex items-baseline justify-between border-t border-borde pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  Total contado
                </span>
                <span className="text-[22px] font-semibold tracking-[-0.02em] text-tinta">
                  {contado ? formatoMoneda(contado) : "—"}
                </span>
              </p>
            </div>

            <GrupoCampo
              etiqueta="Fondo que queda en la caja"
              htmlFor="fondo-siguiente"
              ayuda="Efectivo para dar cambio en el turno siguiente. Lo demás es el retiro."
            >
              <CampoMonto id="fondo-siguiente" valor={fondoSiguienteTexto} onCambio={setFondoSiguienteTexto} />
            </GrupoCampo>

            <div className="flex justify-end border-t border-borde pt-4">
              <Boton variante="primario" onClick={continuar} disabled={bloqueado || ocupado}>
                {ocupado ? "Calculando…" : "Continuar"}
              </Boton>
            </div>
          </Tarjeta>
        ) : null}

        {paso === "confirmar" && previa && contado && diferencia ? (
          <Tarjeta className="space-y-5 px-5 py-5">
            <dl className="cifras space-y-1.5 text-[13px]">
              <FilaMonto etiqueta="Fondo inicial" valor={previa.fondoInicial} />
              <FilaMonto
                etiqueta={`Ventas en efectivo`}
                valor={previa.ventasEfectivo}
                signo="+"
              />
              {aDecimal(previa.devolucionesEfectivo).gt(0) ? (
                <FilaMonto
                  etiqueta="Devoluciones de ventas ya cerradas"
                  valor={previa.devolucionesEfectivo}
                  signo="−"
                />
              ) : null}
              <div className="border-t border-borde pt-1.5">
                <FilaMonto etiqueta="Esperado en la caja" valor={previa.esperado} fuerte />
              </div>
              <FilaMonto etiqueta="Contado" valor={contado.toFixed(2)} fuerte />
              <div className="border-t border-borde pt-1.5">
                <FilaMonto
                  etiqueta={nombreDiferencia(diferencia)}
                  valor={diferencia.toFixed(2)}
                  tono={tonoDiferencia(diferencia)}
                  fuerte
                />
              </div>
              {retiro ? (
                <FilaMonto
                  etiqueta={`Retiro (queda ${formatoMoneda(fondoSiguiente.valido ? fondoSiguiente.monto : 0)})`}
                  valor={retiro.toFixed(2)}
                />
              ) : null}
            </dl>

            <GrupoCampo
              etiqueta={notaObligatoria ? "Nota (obligatoria)" : "Nota (opcional)"}
              htmlFor="notas-cierre"
              ayuda={
                notaObligatoria
                  ? `La diferencia supera L ${DIFERENCIA_CIERRE_NOTA}: explicá qué pasó, o volvé a contar.`
                  : undefined
              }
            >
              <textarea
                id="notas-cierre"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                maxLength={500}
                className={`py-2 ${CLASES_INPUT}`}
              />
            </GrupoCampo>

            <div className="flex flex-wrap justify-end gap-2 border-t border-borde pt-4">
              <Boton
                variante="fantasma"
                onClick={() => {
                  setError(null);
                  setPaso("contar");
                }}
                disabled={ocupado}
              >
                Volver a contar
              </Boton>
              <Boton variante="primario" onClick={confirmar} disabled={bloqueado || ocupado}>
                {ocupado ? "Cerrando…" : "Confirmar cierre"}
              </Boton>
            </div>
          </Tarjeta>
        ) : null}
      </div>

      <Tarjeta className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
          {sucursal.nombre}
        </p>
        <p className="mt-1 text-[13px] text-tinta-media">
          {cierreAnterior ? "Desde el cierre del " : "Desde el inicio del día, "}
          <span className="cifras text-tinta">{formatoFechaHora(new Date(desde))}</span>
        </p>
        <dl className="cifras mt-4 space-y-1.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-tinta-media">Ventas</dt>
            <dd className="text-tinta">{resumen.cantidadVentas}</dd>
          </div>
          {resumen.efectivo ? (
            <FilaMonto etiqueta="Efectivo" valor={resumen.efectivo.ventasEfectivo} />
          ) : (
            <div className="flex justify-between gap-3">
              <dt className="text-tinta-media">Efectivo</dt>
              <dd className="text-tinta-suave">se ve al confirmar</dd>
            </div>
          )}
          <FilaMonto etiqueta="Transferencia" valor={resumen.ventasTransferencia} />
          <FilaMonto etiqueta="Tarjeta" valor={resumen.ventasTarjeta} />
          <FilaMonto etiqueta="Fiado" valor={resumen.ventasFiado} />
        </dl>
        <p className="mt-4 text-[12px] leading-relaxed text-tinta-suave">
          Transferencia, tarjeta y fiado no están en el cajón: se informan, no se cuentan. Los totales
          se recalculan al confirmar.
        </p>
        {cierreAnterior ? (
          <p className="mt-2 text-[12px] text-tinta-suave">
            Fondo recibido del cierre anterior:{" "}
            <span className="cifras text-tinta-media">{formatoMoneda(cierreAnterior.fondoSiguiente)}</span>
          </p>
        ) : (
          <p className="mt-2">
            <Etiqueta tono="info">Primer cierre</Etiqueta>
          </p>
        )}
      </Tarjeta>
    </div>
  );
}

// ------------------------------------------------------------ Piezas

function nombreDiferencia(dif: Prisma.Decimal): string {
  if (dif.isZero()) return "Diferencia: cuadra";
  return dif.gt(0) ? "Sobrante" : "Faltante";
}

function tonoDiferencia(dif: Prisma.Decimal): "exito" | "peligro" | undefined {
  if (dif.isZero()) return undefined;
  return dif.gt(0) ? "exito" : "peligro";
}

function FilaMonto({
  etiqueta,
  valor,
  signo,
  tono,
  fuerte = false,
}: {
  etiqueta: string;
  valor: string;
  signo?: "+" | "−";
  tono?: "exito" | "peligro";
  fuerte?: boolean;
}) {
  const color =
    tono === "exito" ? "text-exito-tinta" : tono === "peligro" ? "text-peligro-tinta" : "text-tinta";
  return (
    <div className="flex justify-between gap-3">
      <dt className={fuerte ? "font-medium text-tinta" : "text-tinta-media"}>{etiqueta}</dt>
      <dd className={`${color} ${fuerte ? "font-semibold" : ""}`}>
        {signo ? `${signo} ` : ""}
        {formatoMoneda(signo ? aDecimal(valor).abs() : valor)}
      </dd>
    </div>
  );
}

function CampoMonto({
  id,
  valor,
  onCambio,
  autoFocus,
}: {
  id: string;
  valor: string;
  onCambio: (valor: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative max-w-56">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
        L
      </span>
      <input
        id={id}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
      />
    </div>
  );
}

function Bloqueo({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-alerta-fondo px-3.5 py-2.5 text-[13px] leading-snug text-alerta-tinta">
      <span className="mt-px shrink-0">
        <Icono nombre="alerta" tamano={15} />
      </span>
      <span>{children}</span>
    </p>
  );
}
