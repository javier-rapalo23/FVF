"use client";

import type { UnidadVenta } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { aDecimal, validarCantidadContada } from "@/lib/calculos";
import { CANTIDAD_MAXIMA_COMPRA, DIAS_AVISO_VENCIMIENTO } from "@/lib/config";
import { cantidad, fecha, formatoMoneda } from "@/lib/formato";
import type { AjusteAplicado, FilaInventario } from "@/lib/inventario/tipos";
import { normalizarCantidad } from "@/lib/texto";

import { registrarConteoLoteAccion } from "../actions";
import { DialogoAjuste, type TipoDialogo } from "./dialogo-ajuste";

/** Lo tipeado en modo conteo, con lo necesario para validarlo y mostrarlo. */
type Contado = { cantidad: string; nombre: string; unidadVenta: UnidadVenta; stock: string };

type Aviso =
  | { tipo: "ajuste"; ajuste: AjusteAplicado }
  | { tipo: "lote"; contados: number; conDiferencia: AjusteAplicado[] };

// ------------------------------------------------- Respaldo ante recarga

/*
 * Un conteo de góndola lleva rato: lo tipeado sobrevive a una recarga o a un
 * cambio de filtro. Todo acceso a `localStorage` va en try/catch (en modo
 * privado puede fallar, y entonces simplemente no hay respaldo).
 */
const claveBorrador = (usuarioId: number, sucursalId: number) =>
  `ferrera:inventario:conteo:${usuarioId}:${sucursalId}`;

function leerBorrador(clave: string): Record<number, Contado> {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return {};
    const datos = JSON.parse(crudo) as Record<string, Partial<Contado>>;
    const limpio: Record<number, Contado> = {};
    for (const [id, c] of Object.entries(datos)) {
      if (
        /^\d+$/.test(id) &&
        typeof c.cantidad === "string" &&
        typeof c.nombre === "string" &&
        typeof c.stock === "string" &&
        (c.unidadVenta === "PESO" || c.unidadVenta === "UNIDAD" || c.unidadVenta === "PAQUETE")
      ) {
        limpio[Number(id)] = c as Contado;
      }
    }
    return limpio;
  } catch {
    return {};
  }
}

function guardarBorrador(clave: string, contados: Record<number, Contado>): void {
  try {
    if (Object.keys(contados).length === 0) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(contados));
  } catch {
    // Sin almacenamiento disponible: se sigue sin respaldo.
  }
}

function validar(c: Contado) {
  return validarCantidadContada(normalizarCantidad(c.cantidad), c.unidadVenta, CANTIDAD_MAXIMA_COMPRA);
}

// ------------------------------------------------------------ Componente

export function TablaInventario({
  filas,
  sucursalId,
  usuarioId,
  consultaSucursal,
  totalVisible,
}: {
  filas: FilaInventario[];
  sucursalId: number;
  usuarioId: number;
  /** `?sucursal=…` para el enlace al historial, si el administrador eligió una. */
  consultaSucursal: string;
  totalVisible: string;
}) {
  const router = useRouter();
  const clave = claveBorrador(usuarioId, sucursalId);

  const [dialogo, setDialogo] = useState<{ tipo: TipoDialogo; fila: FilaInventario } | null>(
    null,
  );
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [modoConteo, setModoConteo] = useState(false);
  const [contados, setContados] = useState<Record<number, Contado>>({});
  const [motivoLote, setMotivoLote] = useState("");
  const [errorLote, setErrorLote] = useState<{ mensaje: string; productoId?: number } | null>(
    null,
  );
  const [pendiente, startTransition] = useTransition();
  const cargado = useRef(false);

  // Un conteo a medias se retoma al volver a la pantalla.
  useEffect(() => {
    const borrador = leerBorrador(clave);
    setContados(borrador);
    setModoConteo(Object.keys(borrador).length > 0);
    cargado.current = true;
  }, [clave]);

  useEffect(() => {
    if (cargado.current) guardarBorrador(clave, contados);
  }, [clave, contados]);

  const entradas = Object.entries(contados).map(([id, c]) => ({ id: Number(id), ...c }));
  const invalidos = entradas.filter((e) => !validar(e).valida);
  const visibles = new Set(filas.map((f) => f.id));
  const fueraDeVista = entradas.filter((e) => !visibles.has(e.id)).length;

  function cambiarContado(fila: FilaInventario, valor: string) {
    setErrorLote(null);
    setContados((previos) => {
      const siguientes = { ...previos };
      if (valor.trim() === "") delete siguientes[fila.id];
      else {
        siguientes[fila.id] = {
          cantidad: valor,
          nombre: fila.nombre,
          unidadVenta: fila.unidadVenta,
          stock: fila.stock,
        };
      }
      return siguientes;
    });
  }

  function salirDeConteo() {
    if (
      entradas.length > 0 &&
      !window.confirm(`Se descarta lo contado en ${entradas.length} productos. ¿Salir del modo conteo?`)
    ) {
      return;
    }
    setContados({});
    setMotivoLote("");
    setErrorLote(null);
    setModoConteo(false);
  }

  function guardarLote() {
    if (entradas.length === 0) {
      setErrorLote({ mensaje: "Todavía no contaste ningún producto." });
      return;
    }
    const primero = invalidos[0];
    if (primero) {
      const r = validar(primero);
      setErrorLote({
        mensaje: `${primero.nombre}: ${r.valida ? "" : r.mensaje}`,
        productoId: primero.id,
      });
      return;
    }
    setErrorLote(null);

    startTransition(async () => {
      try {
        const resultado = await registrarConteoLoteAccion({
          sucursalId,
          motivo: motivoLote.trim() || null,
          items: entradas.map((e) => ({
            productoId: e.id,
            cantidad: normalizarCantidad(e.cantidad),
          })),
        });
        if (!resultado.ok) {
          setErrorLote({ mensaje: resultado.mensaje, productoId: resultado.productoId });
          return;
        }
        setContados({});
        setMotivoLote("");
        setModoConteo(false);
        setAviso({
          tipo: "lote",
          contados: resultado.contados,
          conDiferencia: resultado.conDiferencia,
        });
        router.refresh();
      } catch {
        setErrorLote({ mensaje: "Sin conexión con el servidor. El conteo no se guardó; lo tipeado sigue acá." });
      }
    });
  }

  /** Enter pasa al siguiente casillero, como en una planilla. */
  function siguienteCasillero(actual: HTMLInputElement) {
    const casilleros = [...document.querySelectorAll<HTMLInputElement>("[data-conteo]")];
    const indice = casilleros.indexOf(actual);
    casilleros[indice + 1]?.focus();
  }

  const historial = (id: number) => `/inventario/${id}${consultaSucursal}`;

  return (
    <div>
      {aviso ? <AvisoAjuste aviso={aviso} onCerrar={() => setAviso(null)} /> : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-tinta-suave">
          {filas.length} {filas.length === 1 ? "producto" : "productos"}
          {totalVisible ? (
            <>
              {" · valor "}
              <span className="cifras font-medium text-tinta">{formatoMoneda(totalVisible)}</span>
            </>
          ) : null}
        </p>
        {modoConteo ? null : (
          <Boton
            onClick={() => {
              setAviso(null);
              setModoConteo(true);
            }}
            disabled={filas.length === 0}
          >
            <Icono nombre="inventario" tamano={16} />
            Modo conteo
          </Boton>
        )}
      </div>

      {modoConteo ? (
        <div className="sticky top-0 z-10 mb-3 space-y-3 rounded-xl border border-marca-200 bg-superficie px-4 py-3 shadow-elevado">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-tinta">
                Modo conteo · {entradas.length}{" "}
                {entradas.length === 1 ? "producto contado" : "productos contados"}
              </p>
              <p className="text-[12px] text-tinta-suave">
                Escribí lo que hay en la góndola. Lo que dejes vacío no se toca.
                {fueraDeVista > 0
                  ? ` ${fueraDeVista} ${fueraDeVista === 1 ? "contado está" : "contados están"} fuera de este filtro y también se guardan.`
                  : ""}
              </p>
            </div>
            <input
              value={motivoLote}
              onChange={(evento) => setMotivoLote(evento.target.value)}
              maxLength={500}
              placeholder="Motivo (opcional): Conteo físico"
              aria-label="Motivo del conteo"
              className={`h-9 w-full text-[13px] sm:w-64 ${CLASES_INPUT}`}
            />
            <div className="flex gap-2">
              <Boton variante="fantasma" onClick={salirDeConteo} disabled={pendiente}>
                Cancelar
              </Boton>
              <Boton variante="primario" onClick={guardarLote} disabled={pendiente || entradas.length === 0}>
                {pendiente ? "Guardando…" : "Guardar conteo"}
              </Boton>
            </div>
          </div>
          {errorLote ? <AlertaFormulario mensaje={errorLote.mensaje} /> : null}
        </div>
      ) : null}

      <Tabla
        columnas={[
          { label: "Producto" },
          { label: "Categoría", ocultaMovil: true },
          { label: "Stock", derecha: true },
          { label: "Mínimo", derecha: true, ocultaMovil: true },
          { label: "Último costo", derecha: true, ocultaMovil: true },
          { label: "Valor", derecha: true, ocultaMovil: true },
          { label: modoConteo ? "Contado" : "Acciones", derecha: true },
        ]}
      >
        {filas.map((fila) => {
          const contado = contados[fila.id];
          const validacion = contado ? validar(contado) : null;
          const diferencia =
            validacion?.valida ? validacion.cantidad.minus(fila.stock) : null;
          const marcada = errorLote?.productoId === fila.id;

          return (
            <Fila key={fila.id} atenuada={!fila.activo}>
              <Celda>
                <Link
                  href={historial(fila.id)}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {fila.nombre}
                </Link>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-tinta-suave">
                  <span className="cifras font-mono">{fila.idInterno}</span>
                  <Alertas fila={fila} />
                </span>
              </Celda>
              <Celda ocultaMovil className="text-tinta-media">
                {fila.categoria}
              </Celda>
              <Celda
                derecha
                className={`cifras whitespace-nowrap font-medium ${
                  fila.alertas.negativo
                    ? "text-peligro-tinta"
                    : fila.alertas.bajo
                      ? "text-alerta-tinta"
                      : ""
                }`}
              >
                {cantidad(fila.stock, fila.unidadVenta)}
              </Celda>
              <Celda derecha ocultaMovil className="cifras whitespace-nowrap text-tinta-media">
                {fila.stockMinimo ? cantidad(fila.stockMinimo, fila.unidadVenta) : "—"}
              </Celda>
              <Celda derecha ocultaMovil className="cifras whitespace-nowrap text-tinta-media">
                {fila.costoActual ? formatoMoneda(fila.costoActual) : "—"}
              </Celda>
              <Celda derecha ocultaMovil className="cifras whitespace-nowrap">
                {fila.valor ? formatoMoneda(fila.valor) : <span className="text-tinta-suave">—</span>}
              </Celda>
              <Celda derecha className="whitespace-nowrap">
                {modoConteo ? (
                  <div className="ml-auto w-28 text-right">
                    <input
                      data-conteo
                      value={contado?.cantidad ?? ""}
                      onChange={(evento) => cambiarContado(fila, evento.target.value)}
                      onKeyDown={(evento) => {
                        if (evento.key === "Enter") {
                          evento.preventDefault();
                          siguienteCasillero(evento.currentTarget);
                        }
                      }}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={aDecimal(fila.stock).toString()}
                      aria-label={`Cantidad contada de ${fila.nombre}`}
                      aria-invalid={(validacion && !validacion.valida) || marcada ? true : undefined}
                      className={`cifras h-8 text-right text-[13px] ${CLASES_INPUT}`}
                    />
                    {validacion && !validacion.valida ? (
                      <p className="mt-0.5 whitespace-normal text-[11px] text-peligro-tinta">
                        {validacion.mensaje}
                      </p>
                    ) : diferencia ? (
                      <p
                        className={`cifras mt-0.5 text-[11px] ${
                          diferencia.lt(0)
                            ? "text-peligro-tinta"
                            : diferencia.gt(0)
                              ? "text-exito-tinta"
                              : "text-tinta-suave"
                        }`}
                      >
                        {diferencia.isZero()
                          ? "sin diferencia"
                          : `${diferencia.gt(0) ? "+" : "−"}${cantidad(diferencia.abs().toString(), fila.unidadVenta)}`}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex justify-end gap-1">
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      onClick={() => {
                        setAviso(null);
                        setDialogo({ tipo: "CONTEO", fila });
                      }}
                    >
                      Contar
                    </Boton>
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      onClick={() => {
                        setAviso(null);
                        setDialogo({ tipo: "MERMA", fila });
                      }}
                    >
                      Merma
                    </Boton>
                    <Link
                      href={historial(fila.id)}
                      className={clasesBoton("fantasma", "sm", "hidden sm:inline-flex")}
                    >
                      Historial
                    </Link>
                  </div>
                )}
              </Celda>
            </Fila>
          );
        })}
      </Tabla>

      {dialogo ? (
        <DialogoAjuste
          key={`${dialogo.tipo}-${dialogo.fila.id}`}
          tipo={dialogo.tipo}
          fila={dialogo.fila}
          sucursalId={sucursalId}
          onCerrar={() => setDialogo(null)}
          onAplicado={(ajuste) => {
            setDialogo(null);
            setAviso({ tipo: "ajuste", ajuste });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Alertas({ fila }: { fila: FilaInventario }) {
  const { alertas, diasVencimiento } = fila;
  return (
    <>
      {fila.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
      {alertas.negativo ? <Etiqueta tono="peligro">Negativo</Etiqueta> : null}
      {alertas.bajo && !alertas.negativo ? <Etiqueta tono="alerta">Stock bajo</Etiqueta> : null}
      {alertas.vence && diasVencimiento !== null ? (
        diasVencimiento < 0 ? (
          <Etiqueta tono="peligro">Vencido</Etiqueta>
        ) : (
          <Etiqueta tono="alerta">
            {diasVencimiento === 0 ? "Vence hoy" : `Vence en ${diasVencimiento} d`}
          </Etiqueta>
        )
      ) : fila.vencimiento && diasVencimiento !== null && diasVencimiento > DIAS_AVISO_VENCIMIENTO ? (
        <span className="cifras">vence {fecha(new Date(`${fila.vencimiento}T00:00:00.000Z`))}</span>
      ) : null}
      {fila.avisoOffline ? <Etiqueta tono="info">Revisar conteo</Etiqueta> : null}
    </>
  );
}

function AvisoAjuste({ aviso, onCerrar }: { aviso: Aviso; onCerrar: () => void }) {
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg bg-exito-fondo px-3.5 py-2.5 text-[13px] text-exito-tinta"
    >
      <span className="mt-0.5 shrink-0">
        <Icono nombre="check" tamano={15} />
      </span>
      <div className="min-w-0 flex-1">
        {aviso.tipo === "ajuste" ? (
          <p className="cifras">
            <span className="font-medium">{aviso.ajuste.nombre}</span>:{" "}
            {aviso.ajuste.tipo === "CONTEO" ? "conteo guardado" : "merma registrada"}. Stock{" "}
            {cantidad(aviso.ajuste.stockAnterior, aviso.ajuste.unidadVenta)} →{" "}
            <span className="font-medium">
              {cantidad(aviso.ajuste.stockResultante, aviso.ajuste.unidadVenta)}
            </span>
            .
          </p>
        ) : (
          <>
            <p>
              Conteo guardado: {aviso.contados}{" "}
              {aviso.contados === 1 ? "producto" : "productos"}
              {aviso.conDiferencia.length === 0
                ? ", todos coincidían con el sistema."
                : `, ${aviso.conDiferencia.length} con diferencia:`}
            </p>
            {aviso.conDiferencia.length > 0 ? (
              <ul className="cifras mt-1 space-y-0.5 text-[12px]">
                {aviso.conDiferencia.slice(0, 12).map((a) => {
                  const dif = aDecimal(a.cantidad);
                  return (
                    <li key={a.productoId}>
                      {a.nombre}: {cantidad(a.stockAnterior, a.unidadVenta)} →{" "}
                      {cantidad(a.stockResultante, a.unidadVenta)} ({dif.gt(0) ? "+" : "−"}
                      {cantidad(dif.abs().toString(), a.unidadVenta)})
                    </li>
                  );
                })}
                {aviso.conDiferencia.length > 12 ? (
                  <li>y {aviso.conDiferencia.length - 12} más.</li>
                ) : null}
              </ul>
            ) : null}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded p-0.5 transition-colors duration-150 hover:bg-black/5"
      >
        <Icono nombre="cerrar" tamano={14} />
      </button>
    </div>
  );
}
