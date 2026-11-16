"use client";

import type { CondicionPago } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO, GrupoCampo } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Tarjeta } from "@/components/ui/pagina";
import { Segmentado } from "@/components/ui/segmentado";
import {
  calcularSubtotal,
  calcularTotal,
  validarCantidad,
  validarMontoPositivo,
  type ResultadoCantidad,
  type ResultadoMonto,
} from "@/lib/calculos";
import { advertenciasLinea } from "@/lib/compras/advertencias";
import type {
  PayloadCompra,
  ProductoCompra,
  ResultadoRegistroCompra,
} from "@/lib/compras/tipos";
import { CANTIDAD_MAXIMA_COMPRA } from "@/lib/config";
import { fecha as formatoFecha, formatoMoneda, sufijoUnidad } from "@/lib/formato";
import { normalizarCantidad, nuevaClave } from "@/lib/texto";

import { buscarFacturaRepetida, registrarCompraAccion } from "../actions";
import { BuscadorCompra } from "./buscador-compra";

type Opcion = { id: number; nombre: string };

type LineaCompra = {
  uid: string;
  productoId: number;
  cantidad: string;
  costo: string;
  /** `YYYY-MM-DD` o vacío. */
  vencimiento: string;
};

type Borrador = {
  claveIdempotencia: string;
  proveedorId: number | null;
  sucursalId: number | null;
  fecha: string;
  numeroFactura: string;
  condicionPago: CondicionPago | "";
  notas: string;
  lineas: LineaCompra[];
};

type ResultadoOk = Extract<ResultadoRegistroCompra, { ok: true }>;

function borradorVacio(hoy: string): Borrador {
  return {
    claveIdempotencia: nuevaClave(),
    proveedorId: null,
    sucursalId: null,
    fecha: hoy,
    numeroFactura: "",
    condicionPago: "",
    notas: "",
    lineas: [],
  };
}

function estaVacio(b: Borrador): boolean {
  return b.lineas.length === 0 && b.proveedorId === null && !b.numeroFactura && !b.notas;
}

// ------------------------------------------------- Respaldo ante recarga

/*
 * Una factura larga no se pierde por una recarga. Todo acceso a
 * `localStorage` va en try/catch: en modo privado puede fallar, y entonces
 * simplemente no hay borrador.
 */
const claveBorrador = (usuarioId: number) => `ferrera:compras:borrador:${usuarioId}`;

function leerBorrador(usuarioId: number): Borrador | null {
  try {
    const crudo = localStorage.getItem(claveBorrador(usuarioId));
    if (!crudo) return null;
    const b = JSON.parse(crudo) as Partial<Borrador>;
    if (typeof b.claveIdempotencia !== "string" || !Array.isArray(b.lineas)) return null;
    return {
      claveIdempotencia: b.claveIdempotencia,
      proveedorId: typeof b.proveedorId === "number" ? b.proveedorId : null,
      sucursalId: typeof b.sucursalId === "number" ? b.sucursalId : null,
      fecha: typeof b.fecha === "string" ? b.fecha : "",
      numeroFactura: typeof b.numeroFactura === "string" ? b.numeroFactura : "",
      condicionPago:
        b.condicionPago === "CONTADO" || b.condicionPago === "CREDITO" ? b.condicionPago : "",
      notas: typeof b.notas === "string" ? b.notas : "",
      lineas: b.lineas.filter(
        (l): l is LineaCompra =>
          typeof l === "object" &&
          l !== null &&
          typeof l.uid === "string" &&
          typeof l.productoId === "number" &&
          typeof l.cantidad === "string" &&
          typeof l.costo === "string" &&
          typeof l.vencimiento === "string",
      ),
    };
  } catch {
    return null;
  }
}

function guardarBorrador(usuarioId: number, borrador: Borrador): void {
  try {
    if (estaVacio(borrador)) localStorage.removeItem(claveBorrador(usuarioId));
    else localStorage.setItem(claveBorrador(usuarioId), JSON.stringify(borrador));
  } catch {
    // Sin almacenamiento disponible: se sigue sin respaldo.
  }
}

function borrarBorrador(usuarioId: number): void {
  try {
    localStorage.removeItem(claveBorrador(usuarioId));
  } catch {
    // Nada que hacer.
  }
}

// ------------------------------------------------------------ Componente

export function FormularioCompra({
  usuarioId,
  proveedores,
  productos,
  sucursales: sucursalesIniciales,
  hoy,
  fechaMinima,
}: {
  usuarioId: number;
  proveedores: readonly Opcion[];
  productos: readonly ProductoCompra[];
  /** Vacío si no hace falta elegir (sucursal asignada o una sola). */
  sucursales: readonly Opcion[];
  hoy: string;
  fechaMinima: string;
}) {
  const [borrador, setBorrador] = useState<Borrador>(() => borradorVacio(hoy));
  const [cargado, setCargado] = useState(false);
  const [sucursales, setSucursales] = useState(sucursalesIniciales);
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<{ mensaje: string; productoId?: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoOk | null>(null);
  const [facturas, setFacturas] = useState<{ id: number; fecha: string }[]>([]);
  const [focoPendiente, setFocoPendiente] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const buscador = useRef<HTMLInputElement>(null);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  // El borrador se lee recién en el cliente: en el render del servidor no
  // existe `localStorage`, y leerlo antes rompería la hidratación.
  useEffect(() => {
    const guardado = leerBorrador(usuarioId);
    if (guardado) {
      setBorrador({
        ...guardado,
        // Un producto desactivado desde que se guardó el borrador sale de la lista.
        lineas: guardado.lineas.filter((l) => porId.has(l.productoId)),
        proveedorId: proveedores.some((p) => p.id === guardado.proveedorId)
          ? guardado.proveedorId
          : null,
        fecha: guardado.fecha || hoy,
      });
    }
    setCargado(true);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cargado && !resultado) guardarBorrador(usuarioId, borrador);
  }, [borrador, cargado, resultado, usuarioId]);

  useEffect(() => {
    if (!focoPendiente) return;
    document.getElementById(focoPendiente)?.focus();
    setFocoPendiente(null);
  }, [focoPendiente]);

  function cambiar(cambios: Partial<Borrador>) {
    setBorrador((actual) => ({ ...actual, ...cambios }));
    setError(null);
  }

  function cambiarLinea(uid: string, cambios: Partial<LineaCompra>) {
    setBorrador((actual) => ({
      ...actual,
      lineas: actual.lineas.map((l) => (l.uid === uid ? { ...l, ...cambios } : l)),
    }));
    setError(null);
  }

  function quitarLinea(uid: string) {
    setBorrador((actual) => ({ ...actual, lineas: actual.lineas.filter((l) => l.uid !== uid) }));
    setError(null);
    buscador.current?.focus();
  }

  function agregar(producto: ProductoCompra) {
    setError(null);
    const existente = borrador.lineas.find((l) => l.productoId === producto.id);

    if (existente) {
      // Escanear de nuevo un producto por unidad o paquete suma 1; por peso
      // solo lleva el foco a la cantidad para corregirla.
      if (producto.unidadVenta !== "PESO") {
        const actual = Number(normalizarCantidad(existente.cantidad));
        const base = Number.isInteger(actual) && actual > 0 ? actual : 0;
        cambiarLinea(existente.uid, { cantidad: String(base + 1) });
      }
      setFocoPendiente(`cantidad-${existente.uid}`);
      return;
    }

    const uid = nuevaClave();
    setBorrador((actual) => ({
      ...actual,
      lineas: [
        ...actual.lineas,
        {
          uid,
          productoId: producto.id,
          cantidad: "",
          // Se sugiere el último costo: casi siempre se repite.
          costo: producto.costoActual ? String(Number(producto.costoActual)) : "",
          vencimiento: "",
        },
      ],
    }));
    setFocoPendiente(`cantidad-${uid}`);
  }

  async function revisarFactura() {
    const numero = borrador.numeroFactura.trim();
    if (!numero || borrador.proveedorId === null) {
      setFacturas([]);
      return;
    }
    try {
      setFacturas(await buscarFacturaRepetida(borrador.proveedorId, numero));
    } catch {
      // Es solo un aviso: sin conexión no se muestra.
      setFacturas([]);
    }
  }

  // ---------------------------------------------- Cálculo y validación

  const filas = borrador.lineas.map((linea) => {
    const producto = porId.get(linea.productoId) ?? null;
    const cantidad: ResultadoCantidad | null = linea.cantidad.trim()
      ? validarCantidad(
          normalizarCantidad(linea.cantidad),
          producto?.unidadVenta,
          CANTIDAD_MAXIMA_COMPRA,
        )
      : null;
    const costo: ResultadoMonto | null = linea.costo.trim()
      ? validarMontoPositivo(normalizarCantidad(linea.costo))
      : null;
    const subtotal =
      cantidad?.valida && costo?.valido ? calcularSubtotal(cantidad.cantidad, costo.monto) : null;
    const avisos =
      producto && costo?.valido
        ? advertenciasLinea({
            costo: costo.monto,
            precioMinorista: producto.precioMinorista,
            precioMayorista: producto.precioMayorista,
            costoAnterior: producto.costoActual,
          })
        : [];
    return { linea, producto, cantidad, costo, subtotal, avisos };
  });

  const total = calcularTotal(filas.flatMap((f) => (f.subtotal ? [f.subtotal] : [])));

  const errorFecha = !borrador.fecha
    ? "Elegí la fecha."
    : borrador.fecha > hoy
      ? "No puede ser futura."
      : borrador.fecha < fechaMinima
        ? "Es demasiado antigua."
        : null;

  function errorCantidad(f: (typeof filas)[number]): string | null {
    if (f.cantidad && !f.cantidad.valida) return f.cantidad.mensaje;
    if (!f.cantidad && intentado) return "Falta la cantidad.";
    return null;
  }

  function errorCosto(f: (typeof filas)[number]): string | null {
    if (f.costo && !f.costo.valido) return f.costo.mensaje;
    if (!f.costo && intentado) return "Falta el costo.";
    return null;
  }

  const erroresEncabezado = {
    proveedor: borrador.proveedorId === null ? "Elegí el proveedor." : null,
    condicion: borrador.condicionPago === "" ? "Elegí contado o crédito." : null,
    sucursal: sucursales.length > 0 && borrador.sucursalId === null ? "Elegí la sucursal." : null,
  };

  function guardar() {
    setIntentado(true);
    setError(null);

    const lineasInvalidas = filas.some(
      (f) => !f.producto || !f.cantidad?.valida || !f.costo?.valido,
    );
    if (
      erroresEncabezado.proveedor ||
      erroresEncabezado.condicion ||
      erroresEncabezado.sucursal ||
      errorFecha ||
      filas.length === 0 ||
      lineasInvalidas
    ) {
      setError({
        mensaje:
          filas.length === 0
            ? "Agregá al menos un producto."
            : "Revisá los campos marcados antes de guardar.",
      });
      return;
    }

    const payload: PayloadCompra = {
      claveIdempotencia: borrador.claveIdempotencia,
      proveedorId: borrador.proveedorId!,
      sucursalId: borrador.sucursalId,
      fecha: borrador.fecha,
      numeroFactura: borrador.numeroFactura.trim() || null,
      condicionPago: borrador.condicionPago as CondicionPago,
      notas: borrador.notas.trim() || null,
      items: borrador.lineas.map((linea) => ({
        productoId: linea.productoId,
        cantidad: normalizarCantidad(linea.cantidad),
        costoUnitario: normalizarCantidad(linea.costo),
        fechaVencimiento: linea.vencimiento || null,
      })),
    };

    startTransition(async () => {
      try {
        const respuesta = await registrarCompraAccion(payload);
        if (respuesta.ok) {
          borrarBorrador(usuarioId);
          setResultado(respuesta);
          return;
        }
        if (respuesta.codigo === "SUCURSAL_REQUERIDA" && respuesta.sucursales?.length) {
          setSucursales(respuesta.sucursales);
        }
        setError({ mensaje: respuesta.mensaje, productoId: respuesta.productoId });
      } catch {
        // La clave se conserva: reintentar no duplica la compra si la primera
        // petición sí llegó al servidor.
        setError({
          mensaje: "No se pudo conectar con el servidor. Revisá la conexión y volvé a guardar.",
        });
      }
    });
  }

  function registrarOtra() {
    setBorrador({ ...borradorVacio(hoy), proveedorId: null });
    setResultado(null);
    setIntentado(false);
    setError(null);
    setFacturas([]);
  }

  function descartar() {
    if (!window.confirm("¿Descartar esta compra? Se pierde todo lo cargado.")) return;
    borrarBorrador(usuarioId);
    registrarOtra();
  }

  // ------------------------------------------------------------ Resultado

  if (resultado) {
    return (
      <Tarjeta className="max-w-xl px-6 py-8">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-exito-fondo text-exito-tinta">
            <Icono nombre="check" tamano={18} />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-[16px] font-semibold text-tinta">
              Compra N° {resultado.compraId}{" "}
              {resultado.yaRegistrada ? "ya estaba registrada" : "registrada"}
            </h2>
            <p className="text-[13px] text-tinta-media">
              {resultado.proveedor} ·{" "}
              {resultado.condicionPago === "CREDITO" ? "a crédito" : "de contado"}
            </p>
            <p className="cifras pt-2 text-[24px] font-semibold tracking-[-0.02em] text-tinta">
              {formatoMoneda(resultado.total)}
            </p>
            {resultado.saldoProveedor !== null ? (
              <p className="cifras text-[13px] text-tinta-media">
                Saldo por pagar a {resultado.proveedor}:{" "}
                <span className="font-medium text-tinta">
                  {formatoMoneda(resultado.saldoProveedor)}
                </span>
              </p>
            ) : null}
            <p className="pt-1 text-[12px] text-tinta-suave">
              La mercadería ya sumó al stock y el último costo de cada producto quedó actualizado.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-borde pt-4">
          <Link href={`/compras/${resultado.compraId}`} className={clasesBoton("secundario")}>
            Ver compra
          </Link>
          <Boton variante="primario" onClick={registrarOtra}>
            <Icono nombre="mas" tamano={16} />
            Registrar otra
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  // ------------------------------------------------------------ Formulario

  return (
    <div className="max-w-5xl space-y-4">
      <Tarjeta className="px-5 py-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
          Datos de la factura
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GrupoCampo
            etiqueta="Proveedor"
            htmlFor="proveedor"
            error={intentado ? (erroresEncabezado.proveedor ?? undefined) : undefined}
          >
            <select
              id="proveedor"
              value={borrador.proveedorId ?? ""}
              onChange={(evento) => {
                cambiar({ proveedorId: evento.target.value ? Number(evento.target.value) : null });
                setFacturas([]);
              }}
              aria-invalid={intentado && erroresEncabezado.proveedor ? true : undefined}
              className={`h-10 ${CLASES_SELECT_SUELTO}`}
            >
              <option value="">Elegí…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fecha de la factura"
            htmlFor="fecha"
            error={errorFecha ?? undefined}
          >
            <input
              id="fecha"
              type="date"
              value={borrador.fecha}
              min={fechaMinima}
              max={hoy}
              onChange={(evento) => cambiar({ fecha: evento.target.value })}
              aria-invalid={errorFecha ? true : undefined}
              className={`h-10 ${CLASES_INPUT}`}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="N° de factura"
            htmlFor="factura"
            ayuda={
              facturas.length > 0 ? (
                <span className="text-alerta-tinta">
                  Ya existe con este proveedor:{" "}
                  {facturas.map((f, i) => (
                    <span key={f.id}>
                      {i > 0 ? ", " : ""}
                      <Link href={`/compras/${f.id}`} target="_blank" className="underline">
                        N° {f.id} ({formatoFecha(new Date(f.fecha))})
                      </Link>
                    </span>
                  ))}
                </span>
              ) : (
                "Opcional."
              )
            }
          >
            <input
              id="factura"
              value={borrador.numeroFactura}
              maxLength={60}
              onChange={(evento) => cambiar({ numeroFactura: evento.target.value })}
              onBlur={() => void revisarFactura()}
              autoComplete="off"
              className={`cifras h-10 ${CLASES_INPUT}`}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Condición de pago"
            error={intentado ? (erroresEncabezado.condicion ?? undefined) : undefined}
            ayuda={
              borrador.condicionPago === "CREDITO"
                ? "Suma al saldo por pagar del proveedor."
                : borrador.condicionPago === "CONTADO"
                  ? "Pagada en el momento: no queda deuda."
                  : undefined
            }
          >
            <Segmentado
              etiqueta="Condición de pago"
              valor={borrador.condicionPago}
              onCambio={(valor) => cambiar({ condicionPago: valor })}
              opciones={[
                { valor: "CONTADO", label: "Contado" },
                { valor: "CREDITO", label: "Crédito" },
              ]}
            />
          </GrupoCampo>

          {sucursales.length > 0 ? (
            <GrupoCampo
              etiqueta="Sucursal"
              htmlFor="sucursal"
              error={intentado ? (erroresEncabezado.sucursal ?? undefined) : undefined}
            >
              <select
                id="sucursal"
                value={borrador.sucursalId ?? ""}
                onChange={(evento) =>
                  cambiar({ sucursalId: evento.target.value ? Number(evento.target.value) : null })
                }
                className={`h-10 ${CLASES_SELECT_SUELTO}`}
              >
                <option value="">Elegí…</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </GrupoCampo>
          ) : null}

          <div className="sm:col-span-2 lg:col-span-4">
            <GrupoCampo etiqueta="Notas" htmlFor="notas">
              <textarea
                id="notas"
                value={borrador.notas}
                maxLength={500}
                rows={2}
                onChange={(evento) => cambiar({ notas: evento.target.value })}
                placeholder="Opcional. Ej.: entregó Juan, faltaron 2 cajas"
                className={`py-2 ${CLASES_INPUT}`}
              />
            </GrupoCampo>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
            Productos
          </p>
          {filas.length > 0 ? (
            <span className="cifras text-[12px] text-tinta-suave">
              {filas.length} {filas.length === 1 ? "línea" : "líneas"}
            </span>
          ) : null}
        </div>

        <BuscadorCompra
          ref={buscador}
          productos={productos}
          proveedorId={borrador.proveedorId}
          onElegir={agregar}
        />

        {filas.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-borde px-4 py-8 text-center text-[13px] text-tinta-suave">
            Todavía no agregaste productos.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-borde rounded-lg border border-borde">
            {filas.map((fila) => {
              const { linea, producto } = fila;
              const sufijo = producto ? sufijoUnidad(producto.unidadVenta) : "";
              const conError = error?.productoId === linea.productoId;
              const eCantidad = errorCantidad(fila);
              const eCosto = errorCosto(fila);

              return (
                <li
                  key={linea.uid}
                  className={`px-4 py-3 ${conError ? "bg-peligro-fondo/40" : ""}`}
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_130px_110px_auto] sm:items-start">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-tinta">
                        {producto?.nombre ?? "Producto no disponible"}
                      </p>
                      {producto ? (
                        <p className="cifras mt-0.5 text-[12px] text-tinta-suave">
                          {producto.idInterno} · venta {formatoMoneda(producto.precioMinorista)} /{" "}
                          {formatoMoneda(producto.precioMayorista)} ·{" "}
                          {producto.costoActual === null
                            ? "sin compras previas"
                            : `último costo ${formatoMoneda(producto.costoActual)}`}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label htmlFor={`cantidad-${linea.uid}`} className="sr-only">
                        Cantidad
                      </label>
                      <div className="relative">
                        <input
                          id={`cantidad-${linea.uid}`}
                          value={linea.cantidad}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="Cantidad"
                          onChange={(evento) =>
                            cambiarLinea(linea.uid, { cantidad: evento.target.value })
                          }
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter") {
                              evento.preventDefault();
                              document.getElementById(`costo-${linea.uid}`)?.focus();
                            }
                          }}
                          aria-invalid={eCantidad ? true : undefined}
                          className={`cifras h-9 pr-10 text-right ${CLASES_INPUT}`}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-tinta-suave">
                          {sufijo}
                        </span>
                      </div>
                      {eCantidad ? (
                        <p className="mt-1 text-[11px] text-peligro-tinta">{eCantidad}</p>
                      ) : null}
                    </div>

                    <div>
                      <label htmlFor={`costo-${linea.uid}`} className="sr-only">
                        Costo por {sufijo}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-tinta-suave">
                          L
                        </span>
                        <input
                          id={`costo-${linea.uid}`}
                          value={linea.costo}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={`Costo/${sufijo}`}
                          onChange={(evento) =>
                            cambiarLinea(linea.uid, { costo: evento.target.value })
                          }
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter") {
                              evento.preventDefault();
                              buscador.current?.focus();
                            }
                          }}
                          aria-invalid={eCosto ? true : undefined}
                          className={`cifras h-9 pl-7 text-right ${CLASES_INPUT}`}
                        />
                      </div>
                      {eCosto ? <p className="mt-1 text-[11px] text-peligro-tinta">{eCosto}</p> : null}
                    </div>

                    <p className="cifras pt-2 text-right text-[14px] font-medium text-tinta">
                      {fila.subtotal ? formatoMoneda(fila.subtotal) : "—"}
                    </p>

                    <div className="flex justify-end">
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        onClick={() => quitarLinea(linea.uid)}
                        aria-label={`Quitar ${producto?.nombre ?? "producto"}`}
                      >
                        <Icono nombre="basura" tamano={15} />
                      </Boton>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {fila.avisos.map((aviso) => (
                      <span
                        key={aviso.tipo}
                        className="flex items-center gap-1.5 text-[12px] text-alerta-tinta"
                      >
                        <Icono nombre="alerta" tamano={13} />
                        {aviso.mensaje}
                      </span>
                    ))}
                    <label className="ml-auto flex items-center gap-2 text-[12px] text-tinta-suave">
                      Nuevo vencimiento
                      <input
                        type="date"
                        value={linea.vencimiento}
                        min={hoy}
                        onChange={(evento) =>
                          cambiarLinea(linea.uid, { vencimiento: evento.target.value })
                        }
                        className={`h-8 w-auto text-[12px] ${CLASES_INPUT}`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <div className="sticky bottom-0 z-10 -mx-1 rounded-xl border border-borde bg-superficie px-5 py-4 shadow-elevado">
        <AlertaFormulario mensaje={error?.mensaje ?? null} />
        <div className={`flex flex-wrap items-center justify-between gap-3 ${error ? "mt-3" : ""}`}>
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
              Total
            </span>
            <span className="cifras text-[22px] font-semibold tracking-[-0.02em] text-tinta">
              {formatoMoneda(total)}
            </span>
            {borrador.condicionPago ? (
              <Etiqueta tono={borrador.condicionPago === "CREDITO" ? "alerta" : "neutro"}>
                {borrador.condicionPago === "CREDITO" ? "Crédito" : "Contado"}
              </Etiqueta>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {!estaVacio(borrador) ? (
              <Boton variante="fantasma" onClick={descartar} disabled={pendiente}>
                Descartar
              </Boton>
            ) : null}
            <Boton variante="primario" onClick={guardar} disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar compra"}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}
