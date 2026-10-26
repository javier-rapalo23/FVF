"use client";

import type { Canal, MetodoPago, TipoCliente, UnidadVenta } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT } from "@/components/ui/campo";
import { Etiqueta, Tecla } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { Segmentado } from "@/components/ui/segmentado";
import { cantidad as fmtCantidad, pasoUnidad, precio, sufijoUnidad } from "@/lib/formato";

export type ProductoCaja = {
  id: number;
  idInterno: number;
  nombre: string;
  codigoBarras: string | null;
  categoria: string;
  unidadVenta: UnidadVenta;
  precioMinorista: number;
  precioMayorista: number;
  stock: number;
};

export type ClienteCaja = {
  id: number;
  nombre: string;
  tipo: TipoCliente;
  fiadoHabilitado: boolean;
  limiteCredito: number | null;
};

type Linea = { productoId: number; cantidad: number };

const METODOS: readonly { valor: MetodoPago; label: string }[] = [
  { valor: "EFECTIVO", label: "Efectivo" },
  { valor: "TRANSFERENCIA", label: "Transferencia" },
  { valor: "TARJETA", label: "Tarjeta" },
  { valor: "FIADO", label: "Fiado" },
];

export function CajaPos({
  sucursal,
  productos,
  clientes,
}: {
  sucursal: string;
  productos: readonly ProductoCaja[];
  clientes: readonly ClienteCaja[];
}) {
  const [consulta, setConsulta] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [canal, setCanal] = useState<Canal>("LOCAL");
  const [listaPrecio, setListaPrecio] = useState<TipoCliente>("MINORISTA");
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [cobrada, setCobrada] = useState<{ total: number; items: number } | null>(
    null,
  );

  const buscador = useRef<HTMLInputElement>(null);

  const porId = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto])),
    [productos],
  );

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const precioDe = (producto: ProductoCaja) =>
    listaPrecio === "MAYORISTA" ? producto.precioMayorista : producto.precioMinorista;

  const filtrados = useMemo(() => {
    const termino = consulta.trim().toLowerCase();
    if (!termino) return productos;

    return productos.filter((producto) =>
      [
        producto.nombre,
        producto.categoria,
        String(producto.idInterno),
        producto.codigoBarras ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termino),
    );
  }, [consulta, productos]);

  const detalle = lineas.flatMap((linea) => {
    const producto = porId.get(linea.productoId);
    if (!producto) return [];
    const unitario = precioDe(producto);
    return [{ linea, producto, unitario, subtotal: unitario * linea.cantidad }];
  });

  const total = detalle.reduce((suma, item) => suma + item.subtotal, 0);
  const unidades = detalle.length;

  // Fiado necesita un cliente con cuenta corriente habilitada.
  const fiadoDisponible = cliente?.fiadoHabilitado ?? false;
  useEffect(() => {
    if (metodoPago === "FIADO" && !fiadoDisponible) setMetodoPago("EFECTIVO");
  }, [fiadoDisponible, metodoPago]);

  function elegirCliente(id: number | null) {
    setClienteId(id);
    // La lista de precios sigue al tipo de cliente: es el error más caro de
    // cometer a mano y el que más veces se repite en el día.
    const elegido = clientes.find((c) => c.id === id);
    if (elegido) setListaPrecio(elegido.tipo);
  }

  function agregar(producto: ProductoCaja) {
    setCobrada(null);
    setLineas((previas) => {
      const existente = previas.find((l) => l.productoId === producto.id);
      if (!existente) {
        return [...previas, { productoId: producto.id, cantidad: 1 }];
      }
      return previas.map((l) =>
        l.productoId === producto.id
          ? { ...l, cantidad: redondear(l.cantidad + pasoUnidad(producto.unidadVenta)) }
          : l,
      );
    });
  }

  function ajustar(productoId: number, delta: number) {
    setLineas((previas) =>
      previas.flatMap((l) => {
        if (l.productoId !== productoId) return [l];
        const nueva = redondear(l.cantidad + delta);
        return nueva > 0 ? [{ ...l, cantidad: nueva }] : [];
      }),
    );
  }

  function fijar(productoId: number, valor: number) {
    setLineas((previas) =>
      previas.map((l) =>
        l.productoId === productoId
          ? { ...l, cantidad: Number.isFinite(valor) && valor > 0 ? valor : 0 }
          : l,
      ),
    );
  }

  function quitar(productoId: number) {
    setLineas((previas) => previas.filter((l) => l.productoId !== productoId));
  }

  function nuevaVenta() {
    setLineas([]);
    setClienteId(null);
    setListaPrecio("MINORISTA");
    setMetodoPago("EFECTIVO");
    setCanal("LOCAL");
    setConsulta("");
    setCobrada(null);
    buscador.current?.focus();
  }

  function cobrar() {
    if (total <= 0) return;
    setCobrada({ total, items: unidades });
  }

  // Atajos de teclado: la caja se opera sin soltar el teclado.
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      const enCampo =
        evento.target instanceof HTMLElement &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(evento.target.tagName);

      if (evento.key === "/" && !enCampo) {
        evento.preventDefault();
        // El foco se mueve recién en el frame siguiente: si se enfoca dentro
        // del propio despacho del evento, el navegador escribe la "/" en el
        // campo que acaba de recibir el foco y ensucia la búsqueda.
        requestAnimationFrame(() => buscador.current?.focus());
        return;
      }

      if (evento.key === "F12") {
        evento.preventDefault();
        cobrar();
        return;
      }

      if (evento.key === "Escape") {
        if (cobrada) nuevaVenta();
        else if (consulta) setConsulta("");
      }
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  });

  return (
    // Altura fija para que el ticket y el listado tengan cada uno su propio
    // scroll: la barra superior mide 56px y el padding del main 48px.
    <div className="flex flex-col gap-4 xl:h-[calc(100vh-6.5rem)] xl:flex-row">
      {/* ---------------------------------------------------------- Catálogo */}
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave">
              <Icono nombre="buscar" tamano={16} />
            </span>
            <input
              ref={buscador}
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="Buscar producto, código o categoría"
              aria-label="Buscar producto"
              autoFocus
              className={`h-10 pl-9 pr-12 ${CLASES_INPUT}`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <Tecla>/</Tecla>
            </span>
          </div>

          <Segmentado
            etiqueta="Canal de venta"
            valor={canal}
            onCambio={setCanal}
            opciones={[
              { valor: "LOCAL", label: "Local" },
              { valor: "PEDIDO", label: "Pedido" },
            ]}
          />

          <Segmentado
            etiqueta="Lista de precios"
            valor={listaPrecio}
            onCambio={setListaPrecio}
            opciones={[
              { valor: "MINORISTA", label: "Minorista" },
              { valor: "MAYORISTA", label: "Mayorista" },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-borde bg-superficie">
          {filtrados.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-tinta-media">
              Ningún producto coincide con{" "}
              <span className="font-medium text-tinta">{consulta}</span>.
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {filtrados.map((producto) => {
                const enTicket = lineas.find((l) => l.productoId === producto.id);
                const sinStock = producto.stock <= 0;

                return (
                  <li key={producto.id}>
                    <button
                      type="button"
                      onClick={() => agregar(producto)}
                      className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-superficie-suave"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-medium text-tinta">
                            {producto.nombre}
                          </span>
                          {enTicket ? (
                            <Etiqueta tono="exito">En ticket</Etiqueta>
                          ) : null}
                          {sinStock ? (
                            <Etiqueta tono="peligro">Sin stock</Etiqueta>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-tinta-suave">
                          <span className="cifras font-mono">
                            {producto.idInterno}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{producto.categoria}</span>
                          <span aria-hidden>·</span>
                          <span className="cifras">
                            {fmtCantidad(producto.stock, producto.unidadVenta)} en stock
                          </span>
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="cifras block text-[14px] font-medium text-tinta">
                          {precio(precioDe(producto))}
                        </span>
                        <span className="block text-[11px] text-tinta-suave">
                          por {sufijoUnidad(producto.unidadVenta)}
                        </span>
                      </span>

                      <span className="shrink-0 text-tinta-suave">
                        <Icono nombre="mas" tamano={16} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Ticket */}
      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-borde bg-superficie xl:w-[400px]">
        <header className="space-y-3 border-b border-borde px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tinta">
                Venta en curso
              </h2>
              <p className="text-[11px] text-tinta-suave">{sucursal}</p>
            </div>
            <Etiqueta tono="alerta">Borrador</Etiqueta>
          </div>

          <label className="block">
            <span className="sr-only">Cliente</span>
            <select
              value={clienteId ?? ""}
              onChange={(evento) =>
                elegirCliente(evento.target.value ? Number(evento.target.value) : null)
              }
              className={`h-9 appearance-none pr-8 ${CLASES_INPUT}`}
            >
              <option value="">Consumidor final</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.tipo === "MAYORISTA" ? "Mayorista" : "Minorista"}
                </option>
              ))}
            </select>
          </label>
        </header>

        {/* Detalle */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {detalle.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-borde bg-superficie-suave text-tinta-suave">
                <Icono nombre="caja" tamano={18} />
              </span>
              <p className="text-[13px] font-medium text-tinta">Ticket vacío</p>
              <p className="mt-1 text-[12px] leading-relaxed text-tinta-media">
                Buscá un producto con <Tecla>/</Tecla> y tocalo para agregarlo.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-borde">
              {detalle.map(({ linea, producto, unitario, subtotal }) => {
                const excede = linea.cantidad > producto.stock;

                return (
                  <li key={producto.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-tinta">
                          {producto.nombre}
                        </p>
                        <p className="cifras mt-0.5 text-[11px] text-tinta-suave">
                          {precio(unitario)} / {sufijoUnidad(producto.unidadVenta)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="cifras text-[13px] font-medium text-tinta">
                          {precio(subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => quitar(producto.id)}
                          title={`Quitar ${producto.nombre}`}
                          className="flex h-6 w-6 items-center justify-center rounded text-tinta-suave transition-colors duration-150 hover:bg-peligro-fondo hover:text-peligro-tinta"
                        >
                          <Icono nombre="basura" tamano={14} />
                          <span className="sr-only">Quitar {producto.nombre}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-md border border-borde">
                        <button
                          type="button"
                          onClick={() => ajustar(producto.id, -pasoUnidad(producto.unidadVenta))}
                          className="flex h-7 w-7 items-center justify-center text-tinta-media transition-colors duration-150 hover:bg-superficie-suave hover:text-tinta"
                        >
                          <Icono nombre="menos" tamano={14} />
                          <span className="sr-only">Restar cantidad</span>
                        </button>

                        <input
                          type="number"
                          min={0}
                          step={pasoUnidad(producto.unidadVenta)}
                          value={linea.cantidad}
                          onChange={(evento) =>
                            fijar(producto.id, Number(evento.target.value))
                          }
                          aria-label={`Cantidad de ${producto.nombre}`}
                          className="cifras h-7 w-16 border-x border-borde bg-transparent text-center text-[13px] text-tinta outline-none [appearance:textfield] focus:bg-marca-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />

                        <button
                          type="button"
                          onClick={() => ajustar(producto.id, pasoUnidad(producto.unidadVenta))}
                          className="flex h-7 w-7 items-center justify-center text-tinta-media transition-colors duration-150 hover:bg-superficie-suave hover:text-tinta"
                        >
                          <Icono nombre="mas" tamano={14} />
                          <span className="sr-only">Sumar cantidad</span>
                        </button>
                      </div>

                      <span className="text-[11px] text-tinta-suave">
                        {sufijoUnidad(producto.unidadVenta)}
                      </span>

                      {excede ? (
                        <Etiqueta tono="alerta" className="ml-auto">
                          Supera el stock
                        </Etiqueta>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Cierre */}
        <footer className="space-y-3 border-t border-borde px-4 py-3.5">
          {cobrada ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-exito-fondo px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-exito-tinta">
                  <Icono nombre="check" tamano={15} />
                  Cobro registrado en pantalla
                </p>
                <p className="cifras mt-1 text-[12px] text-exito-tinta/80">
                  {precio(cobrada.total)} · {cobrada.items}{" "}
                  {cobrada.items === 1 ? "producto" : "productos"}
                </p>
              </div>

              <p className="text-[11px] leading-relaxed text-tinta-media">
                La venta todavía no se guarda ni descuenta stock: falta el módulo
                de ventas. Esta pantalla valida el flujo y el diseño.
              </p>

              <Boton
                variante="primario"
                tamano="lg"
                className="w-full"
                onClick={nuevaVenta}
              >
                Nueva venta
              </Boton>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  Método de pago
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {METODOS.map((metodo) => {
                    const activo = metodo.valor === metodoPago;
                    const bloqueado = metodo.valor === "FIADO" && !fiadoDisponible;

                    return (
                      <button
                        key={metodo.valor}
                        type="button"
                        disabled={bloqueado}
                        onClick={() => setMetodoPago(metodo.valor)}
                        title={
                          bloqueado
                            ? cliente
                              ? `${cliente.nombre} no tiene el fiado habilitado`
                              : "Elegí un cliente para cargar la venta a su cuenta"
                            : undefined
                        }
                        className={[
                          "rounded-md border px-2 py-2 text-[12px] transition-colors duration-150",
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
              </div>

              <div className="flex items-end justify-between border-t border-borde pt-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                    Total
                  </p>
                  <p className="text-[11px] text-tinta-media">
                    {unidades} {unidades === 1 ? "producto" : "productos"} ·{" "}
                    {canal === "LOCAL" ? "Local" : "Pedido"}
                  </p>
                </div>
                <p className="cifras text-[28px] font-semibold leading-none tracking-[-0.02em] text-tinta">
                  {precio(total)}
                </p>
              </div>

              <Boton
                variante="primario"
                tamano="lg"
                className="w-full justify-between"
                disabled={total <= 0}
                onClick={cobrar}
              >
                <span>Cobrar</span>
                <span className="font-mono text-[12px] opacity-70">F12</span>
              </Boton>

              {detalle.length > 0 ? (
                <button
                  type="button"
                  onClick={nuevaVenta}
                  className="w-full text-center text-[12px] text-tinta-suave transition-colors duration-150 hover:text-peligro-tinta"
                >
                  Descartar ticket
                </button>
              ) : null}
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

/** Evita que sumar de a 0.1 arrastre error binario al mostrar la cantidad. */
function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}
