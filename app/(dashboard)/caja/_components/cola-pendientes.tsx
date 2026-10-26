"use client";

import type { Rol } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { EstadoVacio } from "@/components/ui/pagina";
import { formatoFechaHora, formatoHora } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import {
  descargarRespaldo,
  listarPendientes,
  quitarPendiente,
  reintentarPendiente,
} from "@/lib/offline/cola";
import { escuchar } from "@/lib/offline/eventos";
import { sincronizar } from "@/lib/offline/motor";
import type { EstadoPendiente, VentaPendiente } from "@/lib/offline/tipos";

import type { DatosComprobante } from "./comprobante";
import { comprobanteDePendiente, ImpresionAislada } from "./impresion-aislada";
import { NOMBRE_METODO } from "./opciones";

const ESTADOS: Record<EstadoPendiente, { label: string; tono: "alerta" | "info" | "peligro" }> = {
  PENDIENTE: { label: "En cola", tono: "alerta" },
  SINCRONIZANDO: { label: "Enviando", tono: "info" },
  ERROR: { label: "Error", tono: "peligro" },
};

function nombreRespaldo(sufijo: string): string {
  const ahora = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `ventas-sin-sincronizar-${sufijo}-${ahora}.json`;
}

/**
 * Ventas cobradas sin conexión que todavía no llegaron al servidor. Se leen
 * del dispositivo, así que la pantalla funciona también sin red.
 */
export function ColaPendientes({ usuario }: { usuario: { id: number; rol: Rol } }) {
  const esAdmin = usuario.rol === "ADMINISTRADOR";
  const [ventas, setVentas] = useState<VentaPendiente[] | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [impresion, setImpresion] = useState<DatosComprobante | null>(null);
  const [aDescartar, setADescartar] = useState<VentaPendiente | null>(null);
  const [respaldoBajado, setRespaldoBajado] = useState(false);

  const recargar = useCallback(async () => setVentas(await listarPendientes()), []);
  const terminarImpresion = useCallback(() => setImpresion(null), []);

  useEffect(() => {
    void recargar();
    return escuchar((evento) => {
      if (evento.tipo === "cola") void recargar();
    });
  }, [recargar]);

  async function sincronizarAhora() {
    setSincronizando(true);
    try {
      await sincronizar({ forzar: true });
    } finally {
      setSincronizando(false);
      await recargar();
    }
  }

  async function reintentar(venta: VentaPendiente) {
    await reintentarPendiente(venta.claveIdempotencia);
    await sincronizarAhora();
  }

  function abrirDescarte(venta: VentaPendiente) {
    setRespaldoBajado(false);
    setADescartar(venta);
  }

  async function descartar() {
    if (!aDescartar || !respaldoBajado) return;
    await quitarPendiente(aDescartar.claveIdempotencia);
    setADescartar(null);
  }

  if (ventas === null) {
    return <p className="text-[13px] text-tinta-media">Leyendo el dispositivo…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-tinta-media">
          Ventas cobradas sin conexión en este dispositivo. Se envían solas al volver la red; las
          que el servidor rechaza quedan acá con el motivo hasta que alguien las resuelva.
        </p>
        <div className="flex items-center gap-2">
          <Boton
            onClick={() => descargarRespaldo(ventas, nombreRespaldo("todas"))}
            disabled={ventas.length === 0}
          >
            Descargar respaldo (JSON)
          </Boton>
          <Boton
            variante="primario"
            onClick={() => void sincronizarAhora()}
            disabled={sincronizando || ventas.length === 0}
          >
            <Icono nombre="recargar" tamano={15} />
            {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
          </Boton>
        </div>
      </div>

      {ventas.length === 0 ? (
        <EstadoVacio icono="check" titulo="Todo sincronizado">
          No hay ventas pendientes en este dispositivo.
        </EstadoVacio>
      ) : (
        <ul className="space-y-2">
          {ventas.map((venta) => {
            const estado = ESTADOS[venta.estado];
            const ajena = !esAdmin && venta.usuarioId !== usuario.id;
            const enEspera = venta.estado === "PENDIENTE" && venta.proximoIntento > Date.now();

            return (
              <li
                key={venta.claveIdempotencia}
                className="rounded-xl border border-borde bg-superficie px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Etiqueta tono={estado.tono}>{estado.label}</Etiqueta>
                      <span className="cifras text-[13px] text-tinta">
                        {formatoFechaHora(new Date(venta.fechaCliente))}
                      </span>
                      <span className="text-[13px] text-tinta-media">
                        · {NOMBRE_METODO[venta.payload.metodoPago]}
                        {venta.resumen.clienteNombre ? ` · ${venta.resumen.clienteNombre}` : ""}
                        {venta.payload.canal === "PEDIDO" ? " · Pedido" : ""}
                      </span>
                    </div>
                    <p className="text-[12px] text-tinta-suave">
                      Vendió {venta.resumen.usuarioNombre} en {venta.resumen.sucursalNombre} ·{" "}
                      {venta.resumen.lineas.length}{" "}
                      {venta.resumen.lineas.length === 1 ? "línea" : "líneas"}
                      {venta.intentos > 0 ? ` · ${venta.intentos} intento${venta.intentos === 1 ? "" : "s"}` : ""}
                    </p>
                    {venta.ultimoError ? (
                      <p
                        className={`text-[12px] ${venta.estado === "ERROR" ? "text-peligro-tinta" : "text-tinta-media"}`}
                      >
                        {venta.ultimoError}
                        {enEspera
                          ? ` Próximo intento a las ${formatoHora(new Date(venta.proximoIntento))}.`
                          : ""}
                      </p>
                    ) : null}
                    {ajena ? (
                      <p className="text-[12px] text-tinta-media">
                        La sincroniza {venta.resumen.usuarioNombre} o un administrador.
                      </p>
                    ) : null}
                  </div>

                  <p className="cifras text-[18px] font-semibold text-tinta">
                    {formatoMoneda(venta.resumen.total)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                  {!ajena && (venta.estado === "ERROR" || enEspera) ? (
                    <Boton tamano="sm" onClick={() => void reintentar(venta)}>
                      Reintentar
                    </Boton>
                  ) : null}
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    onClick={() => setImpresion(comprobanteDePendiente(venta))}
                  >
                    <Icono nombre="imprimir" tamano={14} />
                    Imprimir
                  </Boton>
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    onClick={() =>
                      descargarRespaldo([venta], nombreRespaldo(venta.claveIdempotencia.slice(0, 8)))
                    }
                  >
                    Respaldo
                  </Boton>
                  {esAdmin ? (
                    <Boton
                      tamano="sm"
                      variante="peligro"
                      className="ml-auto"
                      onClick={() => abrirDescarte(venta)}
                    >
                      Descartar
                    </Boton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialogo
        abierto={aDescartar !== null}
        onCerrar={() => setADescartar(null)}
        titulo="Descartar venta sin sincronizar"
      >
        {aDescartar ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-tinta-media">
              La venta de {formatoMoneda(aDescartar.resumen.total)} del{" "}
              {formatoFechaHora(new Date(aDescartar.fechaCliente))} se borra de este dispositivo y
              nunca llega al servidor: no descuenta stock ni carga la cuenta del cliente. Primero
              descargá el respaldo.
            </p>
            <Boton
              className="w-full"
              data-autofocus
              onClick={() => {
                descargarRespaldo(
                  [aDescartar],
                  nombreRespaldo(`descartada-${aDescartar.claveIdempotencia.slice(0, 8)}`),
                );
                setRespaldoBajado(true);
              }}
            >
              {respaldoBajado ? "Respaldo descargado" : "1. Descargar respaldo"}
            </Boton>
            <div className="flex justify-end gap-2 border-t border-borde pt-4">
              <Boton variante="fantasma" onClick={() => setADescartar(null)}>
                Cancelar
              </Boton>
              <Boton
                variante="peligro"
                disabled={!respaldoBajado}
                onClick={() => void descartar()}
              >
                2. Descartar definitivamente
              </Boton>
            </div>
          </div>
        ) : null}
      </Dialogo>

      <ImpresionAislada datos={impresion} onTerminar={terminarImpresion} />
    </div>
  );
}
