"use client";

import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { aDecimal, validarCantidad, validarCantidadContada } from "@/lib/calculos";
import { CANTIDAD_MAXIMA_COMPRA } from "@/lib/config";
import { formatoFechaHora } from "@/lib/fecha";
import { cantidad, sufijoUnidad } from "@/lib/formato";
import type { AjusteAplicado, FilaInventario } from "@/lib/inventario/tipos";
import { normalizarCantidad } from "@/lib/texto";

import { registrarConteoAccion, registrarMermaAccion } from "../actions";

export type TipoDialogo = "CONTEO" | "MERMA";

const MOTIVOS_MERMA = ["Dañado", "Vencido", "Faltante / robo", "Consumo interno"] as const;

/**
 * Conteo de un producto o registro de merma. El diálogo se monta por cada
 * apertura (lo controla el padre), así que arranca siempre limpio.
 */
export function DialogoAjuste({
  tipo,
  fila,
  sucursalId,
  onCerrar,
  onAplicado,
}: {
  tipo: TipoDialogo;
  fila: FilaInventario;
  sucursalId: number;
  onCerrar: () => void;
  onAplicado: (ajuste: AjusteAplicado) => void;
}) {
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const esConteo = tipo === "CONTEO";
  const unidad = fila.unidadVenta;
  const stock = aDecimal(fila.stock);

  const limpio = normalizarCantidad(texto);
  const validacion =
    limpio === ""
      ? null
      : esConteo
        ? validarCantidadContada(limpio, unidad, CANTIDAD_MAXIMA_COMPRA)
        : validarCantidad(limpio, unidad, CANTIDAD_MAXIMA_COMPRA);
  const valida = validacion?.valida ? validacion.cantidad : null;

  const resultante = valida === null ? null : esConteo ? valida : stock.minus(valida);
  const diferencia = resultante === null ? null : resultante.minus(stock);

  function cerrar() {
    if (!pendiente) onCerrar();
  }

  function confirmar() {
    if (validacion === null) {
      setError(esConteo ? "Escribí la cantidad contada." : "Escribí la cantidad perdida.");
      return;
    }
    if (!validacion.valida) {
      setError(validacion.mensaje);
      return;
    }
    if (!esConteo && motivo.trim().length < 3) {
      setError("Escribí el motivo de la merma.");
      return;
    }
    setError(null);

    const payload = {
      productoId: fila.id,
      sucursalId,
      cantidad: validacion.cantidad.toString(),
      motivo: motivo.trim() || null,
    };

    startTransition(async () => {
      try {
        const resultado = esConteo
          ? await registrarConteoAccion(payload)
          : await registrarMermaAccion(payload);
        if (!resultado.ok) {
          setError(resultado.mensaje);
          return;
        }
        onAplicado(resultado);
      } catch {
        setError("Sin conexión con el servidor. El ajuste no se guardó.");
      }
    });
  }

  return (
    <Dialogo
      abierto
      onCerrar={cerrar}
      titulo={`${esConteo ? "Contar" : "Registrar merma"}: ${fila.nombre}`}
    >
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar();
        }}
      >
        <p className="cifras text-[13px] text-tinta-media">
          Stock según el sistema:{" "}
          <span className={`font-medium ${stock.lt(0) ? "text-peligro-tinta" : "text-tinta"}`}>
            {cantidad(fila.stock, unidad)}
          </span>
        </p>

        {esConteo && fila.avisoOffline ? (
          <p className="flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2.5 text-[12px] leading-snug text-alerta-tinta">
            <span className="mt-px shrink-0">
              <Icono nombre="alerta" tamano={14} />
            </span>
            <span>
              Desde el último conteo ({formatoFechaHora(new Date(fila.avisoOffline.ultimoConteo))})
              se sincronizó{" "}
              {fila.avisoOffline.ventas === 1
                ? "una venta sin conexión cobrada"
                : `${fila.avisoOffline.ventas} ventas sin conexión cobradas`}{" "}
              antes de ese conteo: el stock pudo quedar más bajo que lo contado. Conviene volver a
              contar.
            </span>
          </p>
        ) : null}

        <AlertaFormulario mensaje={error} />

        <GrupoCampo
          etiqueta={esConteo ? "Cantidad contada" : "Cantidad perdida"}
          htmlFor="cantidad-ajuste"
          ayuda={
            unidad === "PESO"
              ? `En ${sufijoUnidad(unidad)}, hasta 3 decimales.`
              : `En ${sufijoUnidad(unidad)}, enteras.`
          }
        >
          <div className="relative">
            <input
              id="cantidad-ajuste"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              inputMode="decimal"
              autoComplete="off"
              data-autofocus
              aria-invalid={validacion !== null && !validacion.valida ? true : undefined}
              className={`cifras h-10 pr-12 ${CLASES_INPUT}`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-tinta-suave">
              {sufijoUnidad(unidad)}
            </span>
          </div>
        </GrupoCampo>

        {resultante !== null && diferencia !== null ? (
          <div className="cifras flex flex-wrap justify-between gap-2 rounded-md bg-superficie-suave px-3 py-2.5 text-[13px]">
            <span className="text-tinta-media">
              Diferencia{" "}
              <span
                className={`font-medium ${diferencia.lt(0) ? "text-peligro-tinta" : diferencia.gt(0) ? "text-exito-tinta" : "text-tinta"}`}
              >
                {diferencia.gt(0) ? "+" : diferencia.lt(0) ? "−" : ""}
                {cantidad(diferencia.abs().toString(), unidad)}
              </span>
            </span>
            <span className="text-tinta-media">
              Queda{" "}
              <span
                className={`font-medium ${resultante.lt(0) ? "text-peligro-tinta" : "text-tinta"}`}
              >
                {cantidad(resultante.toString(), unidad)}
              </span>
            </span>
          </div>
        ) : null}

        {!esConteo && resultante !== null && resultante.lt(0) ? (
          <p className="text-[12px] text-alerta-tinta">
            El stock va a quedar en negativo. Se permite, pero revisalo con un conteo.
          </p>
        ) : null}

        <GrupoCampo
          etiqueta={esConteo ? "Motivo (opcional)" : "Motivo"}
          htmlFor="motivo-ajuste"
        >
          <input
            id="motivo-ajuste"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            maxLength={500}
            autoComplete="off"
            placeholder={esConteo ? "Conteo físico" : "Ej.: producto golpeado"}
            className={`h-10 ${CLASES_INPUT}`}
          />
          {esConteo ? null : (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {MOTIVOS_MERMA.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={[
                    "rounded-md border px-2 py-1 text-[12px] transition-colors duration-150",
                    motivo === m
                      ? "border-marca-500 bg-marca-50 text-tinta"
                      : "border-borde text-tinta-media hover:border-borde-fuerte hover:text-tinta",
                  ].join(" ")}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </GrupoCampo>

        <div className="flex justify-end gap-2 border-t border-borde pt-4">
          <Boton variante="fantasma" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Boton>
          <Boton type="submit" variante={esConteo ? "primario" : "peligro"} disabled={pendiente}>
            {pendiente ? "Guardando…" : esConteo ? "Guardar conteo" : "Registrar merma"}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
