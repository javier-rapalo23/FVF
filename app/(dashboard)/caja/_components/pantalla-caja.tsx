"use client";

import type { MetodoPago, Prisma, Rol } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Icono } from "@/components/ui/icono";
import { Segmentado } from "@/components/ui/segmentado";
import { diaDelNegocio, formatoHora } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import {
  aDecimal,
  calcularSubtotal,
  calcularTotal,
  calcularVuelto,
  textoCantidad,
  textoMonto,
  validarCantidad,
} from "@/lib/ventas/calculos";
import { precioSegunCliente } from "@/lib/ventas/precios";
import type {
  Catalogo,
  DatosExcesoCredito,
  PayloadVenta,
  ProductoCatalogo,
  RespuestaError,
  RespuestaVenta,
} from "@/lib/ventas/tipos";

import { BuscadorProducto } from "./buscador-producto";
import {
  carritoVacio,
  guardarCarrito,
  guardarSucursal,
  leerCarrito,
  leerSucursal,
  normalizarCantidad,
  nuevaClave,
  type Carrito,
  type FilaCarrito,
} from "./carrito";
import { LineasCarrito } from "./lineas-carrito";
import { PanelCobro, type ErrorCobro } from "./panel-cobro";
import { ResultadoVenta, type Resultado } from "./resultado-venta";
import { SelectorCliente } from "./selector-cliente";

/** El catálogo se refresca solo mientras haya conexión. */
const REFRESCO_CATALOGO_MS = 60_000;
/** Pasado este tiempo sin respuesta, el cobro se da por fallido (y se puede reintentar). */
const ESPERA_COBRO_MS = 15_000;

type Sucursal = { id: number; nombre: string };

export function PantallaCaja({
  usuario,
  sucursales,
}: {
  usuario: { id: number; rol: Rol };
  /** Solo para un administrador sin sucursal asignada y con más de una para elegir. */
  sucursales: readonly Sucursal[];
}) {
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  // ------------------------------------------------------------ Catálogo
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  const necesitaSucursal = sucursales.length > 1 && sucursalId === null;
  const sucursalVigente = useRef(sucursalId);
  sucursalVigente.current = sucursalId;
  /** Momento del último cobro: un catálogo pedido antes llega con stock viejo. */
  const ultimaVenta = useRef(0);

  const cargarCatalogo = useCallback(async () => {
    const pedidoEn = Date.now();
    const pedida = sucursalId;
    setCargandoCatalogo(true);

    try {
      const respuesta = await fetch(
        `/api/caja/catalogo${pedida !== null ? `?sucursalId=${pedida}` : ""}`,
        { cache: "no-store" },
      );
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | Catalogo
        | RespuestaError
        | null;

      if (pedida !== sucursalVigente.current) return;

      if (!respuesta.ok || !cuerpo || "error" in cuerpo) {
        setErrorCatalogo(
          (cuerpo && "mensaje" in cuerpo ? cuerpo.mensaje : null) ??
            "No se pudo cargar el catálogo.",
        );
        return;
      }

      if (pedidoEn < ultimaVenta.current) return;
      setCatalogo(cuerpo);
      setErrorCatalogo(null);
    } catch {
      setErrorCatalogo("Sin conexión con el servidor. Se reintenta solo.");
    } finally {
      setCargandoCatalogo(false);
    }
  }, [sucursalId]);

  useEffect(() => {
    if (necesitaSucursal) return;

    void cargarCatalogo();
    const intervalo = setInterval(() => {
      if (navigator.onLine) void cargarCatalogo();
    }, REFRESCO_CATALOGO_MS);
    return () => clearInterval(intervalo);
  }, [cargarCatalogo, necesitaSucursal]);

  function elegirSucursal(id: number) {
    setSucursalId(id);
    setCatalogo(null);
    guardarSucursal(usuario.id, id);
  }

  // ------------------------------------------------------------- Carrito
  const [carrito, setCarrito] = useState<Carrito>(carritoVacio);
  const [restaurado, setRestaurado] = useState(false);
  const [metodoElegido, setMetodoElegido] = useState<MetodoPago>("EFECTIVO");
  const [recibido, setRecibido] = useState("");
  const [focoCantidad, setFocoCantidad] = useState<string | null>(null);

  // Cobro
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [errorCobro, setErrorCobro] = useState<ErrorCobro>(null);
  const [exceso, setExceso] = useState<DatosExcesoCredito | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // El respaldo se lee recién en el cliente: en el render del servidor no
  // existe `localStorage`, y leerlo antes rompería la hidratación.
  useEffect(() => {
    const guardado = leerCarrito(usuario.id);
    if (guardado) setCarrito(guardado);
    if (sucursales.length > 1) {
      const preferida = leerSucursal(usuario.id);
      if (preferida !== null && sucursales.some((s) => s.id === preferida)) {
        setSucursalId(preferida);
      }
    }
    setRestaurado(true);
  }, [usuario.id, sucursales]);

  useEffect(() => {
    if (restaurado) guardarCarrito(usuario.id, carrito);
  }, [carrito, restaurado, usuario.id]);

  // ---------------------------------------------------------- Referencias
  const buscador = useRef<HTMLInputElement>(null);
  const panelCobro = useRef<HTMLDivElement>(null);
  const campoRecibido = useRef<HTMLInputElement>(null);
  const botonCobrar = useRef<HTMLButtonElement>(null);

  const enfocarBuscador = useCallback(() => {
    requestAnimationFrame(() => buscador.current?.focus());
  }, []);

  const limpiarFoco = useCallback(() => setFocoCantidad(null), []);

  // ------------------------------------------------------------ Derivados
  const productoPorId = useMemo(
    () => new Map((catalogo?.productos ?? []).map((p) => [p.id, p])),
    [catalogo],
  );

  const cliente =
    carrito.clienteId === null
      ? null
      : (catalogo?.clientes.find((c) => c.id === carrito.clienteId) ?? null);
  const clienteNoDisponible = catalogo !== null && carrito.clienteId !== null && !cliente;

  const hoy = diaDelNegocio();

  const filas: FilaCarrito[] = carrito.lineas.map((linea) => {
    const producto = productoPorId.get(linea.productoId) ?? null;
    if (!producto) {
      return {
        linea,
        producto: null,
        cantidad: null,
        precioUnitario: null,
        subtotal: null,
        superaStock: false,
        vencido: false,
      };
    }

    const cantidad = validarCantidad(normalizarCantidad(linea.cantidad), producto.unidadVenta);
    const precioUnitario = precioSegunCliente(producto, cliente?.tipo);
    return {
      linea,
      producto,
      cantidad,
      precioUnitario,
      subtotal: cantidad.valida ? calcularSubtotal(cantidad.cantidad, precioUnitario) : null,
      superaStock: false,
      vencido:
        producto.fechaVencimiento !== null && producto.fechaVencimiento.slice(0, 10) < hoy,
    };
  });

  // Stock: se compara lo pedido de cada producto (sumando líneas) con el conocido.
  const pedidoPorProducto = new Map<number, Prisma.Decimal>();
  for (const fila of filas) {
    if (fila.producto && fila.cantidad?.valida) {
      const previo = pedidoPorProducto.get(fila.producto.id) ?? aDecimal(0);
      pedidoPorProducto.set(fila.producto.id, previo.plus(fila.cantidad.cantidad));
    }
  }
  for (const fila of filas) {
    if (fila.producto) {
      const pedido = pedidoPorProducto.get(fila.producto.id);
      fila.superaStock = pedido !== undefined && pedido.gt(fila.producto.stock);
    }
  }

  const total = calcularTotal(filas.flatMap((fila) => (fila.subtotal ? [fila.subtotal] : [])));

  const motivoSinFiado = !cliente
    ? "elegí un cliente para cargar la venta a su cuenta."
    : !cliente.fiadoHabilitado
      ? `${cliente.nombre} no tiene el fiado habilitado.`
      : null;

  // Si el cliente cambia y ya no puede fiar, se vuelve a efectivo sin avisar.
  const metodoPago: MetodoPago =
    metodoElegido === "FIADO" && motivoSinFiado ? "EFECTIVO" : metodoElegido;

  const credito = (() => {
    if (metodoPago !== "FIADO" || !cliente || cliente.limiteCredito === null) return null;
    const saldo = aDecimal(cliente.saldo);
    const limite = aDecimal(cliente.limiteCredito);
    const exceso = saldo.plus(total).minus(limite);
    return exceso.gt(0) ? { saldo, limite, exceso } : null;
  })();

  const recibidoTexto = normalizarCantidad(recibido);
  const recibidoValido = /^\d+(\.\d{1,2})?$/.test(recibidoTexto);
  const vuelto =
    metodoPago === "EFECTIVO" && recibidoValido ? calcularVuelto(recibidoTexto, total) : null;

  const motivoBloqueo = !catalogo
    ? "Esperando el catálogo…"
    : filas.length === 0
      ? "Agregá al menos un producto."
      : filas.some((fila) => !fila.producto)
        ? "Hay productos que ya no están disponibles: quitalos."
        : filas.some((fila) => !fila.cantidad?.valida)
          ? "Revisá las cantidades marcadas."
          : carrito.canal === "PEDIDO" && carrito.clienteId === null
            ? "Un pedido necesita un cliente."
            : clienteNoDisponible
              ? "El cliente elegido ya no está disponible."
              : metodoPago === "EFECTIVO" && recibido.trim() && !recibidoValido
                ? "El monto recibido no es válido."
                : vuelto?.lt(0)
                  ? "El monto recibido no alcanza."
                  : credito && !esAdmin
                    ? "La venta supera el límite de crédito del cliente."
                    : null;

  // -------------------------------------------------------------- Acciones
  function actualizarCarrito(cambio: (actual: Carrito) => Carrito) {
    // Con un cobro en curso el carrito queda congelado: al confirmarse se
    // vacía, y lo agregado mientras tanto se perdería.
    if (enviandoRef.current) return;
    setErrorCobro(null);
    setCarrito(cambio);
  }

  function agregar(producto: ProductoCatalogo) {
    if (producto.unidadVenta === "PESO") {
      // Cada pesada es su propia línea; el foco pasa a la cantidad.
      const uid = nuevaClave();
      actualizarCarrito((c) => ({
        ...c,
        lineas: [...c.lineas, { uid, productoId: producto.id, cantidad: "" }],
      }));
      setFocoCantidad(uid);
      return;
    }

    actualizarCarrito((c) => {
      const indice = c.lineas.findLastIndex((l) => l.productoId === producto.id);
      if (indice === -1) {
        const uid = nuevaClave();
        return { ...c, lineas: [...c.lineas, { uid, productoId: producto.id, cantidad: "1" }] };
      }

      // Escanear de nuevo el mismo producto suma 1 a su línea.
      const linea = c.lineas[indice]!;
      const actual = validarCantidad(normalizarCantidad(linea.cantidad), producto.unidadVenta);
      const nueva = actual.valida ? actual.cantidad.plus(1).toString() : "1";
      return {
        ...c,
        lineas: c.lineas.map((l, i) => (i === indice ? { ...l, cantidad: nueva } : l)),
      };
    });
    enfocarBuscador();
  }

  function cambiarCantidad(uid: string, texto: string) {
    actualizarCarrito((c) => ({
      ...c,
      lineas: c.lineas.map((l) => (l.uid === uid ? { ...l, cantidad: texto } : l)),
    }));
  }

  function quitar(uid: string) {
    actualizarCarrito((c) => ({ ...c, lineas: c.lineas.filter((l) => l.uid !== uid) }));
    enfocarBuscador();
  }

  function descartar() {
    actualizarCarrito(() => carritoVacio());
    setMetodoElegido("EFECTIVO");
    setRecibido("");
    enfocarBuscador();
  }

  // ----------------------------------------------------------------- Cobro
  async function cobrar(confirmarExcesoCredito = false) {
    if (enviandoRef.current || motivoBloqueo || !catalogo) return;

    const payload: PayloadVenta = {
      claveIdempotencia: carrito.claveIdempotencia,
      canal: carrito.canal,
      clienteId: carrito.clienteId,
      metodoPago,
      sucursalId: catalogo.sucursal.id,
      notas: carrito.canal === "PEDIDO" ? carrito.notas.trim() || null : null,
      confirmarExcesoCredito,
      items: filas.map((fila) => ({
        productoId: fila.linea.productoId,
        cantidad: fila.cantidad?.valida ? fila.cantidad.cantidad.toString() : "",
      })),
    };

    enviandoRef.current = true;
    setEnviando(true);
    setErrorCobro(null);

    try {
      const respuesta = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ESPERA_COBRO_MS),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaVenta
        | RespuestaError
        | null;

      if (respuesta.ok && cuerpo && !("error" in cuerpo)) {
        ventaRegistrada(cuerpo);
        return;
      }

      const error = cuerpo && "error" in cuerpo ? cuerpo : null;
      if (error?.error === "LIMITE_CREDITO_EXCEDIDO" && error.puedeConfirmar) {
        setExceso(error as unknown as DatosExcesoCredito);
        return;
      }

      setErrorCobro({
        mensaje: error?.mensaje ?? `El servidor respondió con un error (${respuesta.status}).`,
        sesionVencida: respuesta.status === 401,
      });
    } catch {
      // Red caída o sin respuesta a tiempo. La venta pudo haber llegado: el
      // reintento usa la misma clave y el servidor no la duplica.
      setErrorCobro({
        mensaje:
          "No hubo respuesta del servidor. Revisá la conexión y volvé a cobrar: si la venta ya se había registrado, no se duplica.",
      });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  function ventaRegistrada(venta: RespuestaVenta) {
    ultimaVenta.current = Date.now();

    const productos = new Map(
      filas.flatMap((fila) =>
        fila.producto
          ? [[fila.producto.id, { nombre: fila.producto.nombre, unidadVenta: fila.producto.unidadVenta }] as const]
          : [],
      ),
    );

    setResultado({
      venta,
      metodoPago,
      clienteNombre: cliente?.nombre ?? null,
      vuelto: vuelto && !vuelto.lt(0) ? vuelto : null,
      productos,
    });

    // Stock y saldo se actualizan en el momento; el refresco del catálogo
    // trae después los valores definitivos.
    if (!venta.yaRegistrada) {
      setCatalogo((actual) =>
        actual && {
          ...actual,
          productos: actual.productos.map((p) => {
            const salida = pedidoPorProducto.get(p.id);
            return salida ? { ...p, stock: textoCantidad(aDecimal(p.stock).minus(salida)) } : p;
          }),
          clientes:
            metodoPago === "FIADO"
              ? actual.clientes.map((c) =>
                  c.id === carrito.clienteId
                    ? { ...c, saldo: textoMonto(aDecimal(c.saldo).plus(venta.total)) }
                    : c,
                )
              : actual.clientes,
        },
      );
    }

    // La próxima venta arranca con una clave nueva.
    setCarrito(carritoVacio());
    setMetodoElegido("EFECTIVO");
    setRecibido("");
    setExceso(null);
  }

  function nuevaVenta() {
    setResultado(null);
    enfocarBuscador();
  }

  // ------------------------------------------------------ Atajos de teclado
  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "F2") {
        evento.preventDefault();
        buscador.current?.focus();
        return;
      }

      if (evento.key === "F4") {
        evento.preventDefault();
        if (resultado || exceso) return;

        // Primer F4: lleva al cobro. Segundo F4, ya dentro del panel: cobra.
        if (panelCobro.current?.contains(document.activeElement)) {
          void cobrar();
        } else if (metodoPago === "EFECTIVO") {
          campoRecibido.current?.focus();
        } else {
          botonCobrar.current?.focus();
        }
      }
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  });

  // ------------------------------------------------------------------ Vista
  if (sucursales.length > 1 && necesitaSucursal && restaurado) {
    return (
      <div className="max-w-md rounded-xl border border-borde bg-superficie px-5 py-5">
        <p className="text-[14px] font-medium text-tinta">¿En qué sucursal estás vendiendo?</p>
        <p className="mt-1 text-[13px] text-tinta-media">
          Tu usuario no tiene una sucursal fija. El stock se descuenta de la que elijas.
        </p>
        <div className="mt-4 grid gap-2">
          {sucursales.map((sucursal) => (
            <Boton key={sucursal.id} onClick={() => elegirSucursal(sucursal.id)}>
              {sucursal.nombre}
            </Boton>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* ------------------------------------------- Búsqueda y líneas */}
      <section className="min-w-0 space-y-3">
        <BuscadorProducto
          ref={buscador}
          productos={catalogo?.productos ?? []}
          tipoCliente={cliente?.tipo ?? null}
          deshabilitado={!catalogo || enviando}
          onElegir={agregar}
        />

        <LineasCarrito
          filas={filas}
          focoEn={focoCantidad}
          onFocoAplicado={limpiarFoco}
          onCantidad={cambiarCantidad}
          onConfirmar={enfocarBuscador}
          onQuitar={quitar}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-tinta-suave">
          <span className="flex items-center gap-2">
            {catalogo ? (
              <>
                <span>{catalogo.sucursal.nombre}</span>
                <span aria-hidden>·</span>
                <span>
                  {catalogo.productos.length} productos, actualizado{" "}
                  {formatoHora(new Date(catalogo.generadoEn))}
                </span>
              </>
            ) : (
              <span>{errorCatalogo ? "" : "Cargando catálogo…"}</span>
            )}
            <button
              type="button"
              onClick={() => void cargarCatalogo()}
              disabled={cargandoCatalogo}
              title="Actualizar catálogo"
              className="flex h-6 w-6 items-center justify-center rounded text-tinta-suave transition-colors duration-150 hover:bg-superficie-suave hover:text-tinta disabled:opacity-40"
            >
              <Icono nombre="recargar" tamano={14} />
              <span className="sr-only">Actualizar catálogo</span>
            </button>
          </span>

          <span className="flex items-center gap-3">
            {sucursales.length > 1 && sucursalId !== null ? (
              <select
                value={sucursalId}
                onChange={(evento) => elegirSucursal(Number(evento.target.value))}
                aria-label="Sucursal"
                className={`h-8 w-auto text-[12px] ${CLASES_SELECT_SUELTO}`}
              >
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : null}
            {carrito.lineas.length > 0 ? (
              <button
                type="button"
                onClick={descartar}
                className="transition-colors duration-150 hover:text-peligro-tinta"
              >
                Descartar venta
              </button>
            ) : null}
          </span>
        </div>

        {errorCatalogo ? (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md bg-alerta-fondo px-3 py-2 text-[13px] text-alerta-tinta"
          >
            <Icono nombre="alerta" tamano={15} />
            {errorCatalogo}
            {catalogo
              ? ` Se muestran los datos de las ${formatoHora(new Date(catalogo.generadoEn))}.`
              : ""}
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------- Cliente y cobro */}
      <aside className="space-y-3 self-start xl:sticky xl:top-20">
        <div className="space-y-3 rounded-xl border border-borde bg-superficie px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
              Cliente
            </p>
            <Segmentado
              etiqueta="Canal de venta"
              valor={carrito.canal}
              onCambio={(canal) => actualizarCarrito((c) => ({ ...c, canal }))}
              opciones={[
                { valor: "LOCAL", label: "Local" },
                { valor: "PEDIDO", label: "Pedido" },
              ]}
            />
          </div>

          <SelectorCliente
            clientes={catalogo?.clientes ?? []}
            cliente={cliente}
            clienteNoDisponible={clienteNoDisponible}
            permitirSinCliente={carrito.canal === "LOCAL"}
            onCambio={(clienteId) => {
              actualizarCarrito((c) => ({ ...c, clienteId }));
              enfocarBuscador();
            }}
          />

          {carrito.canal === "PEDIDO" ? (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-tinta-media">
                Notas del pedido
              </span>
              <textarea
                value={carrito.notas}
                onChange={(evento) =>
                  actualizarCarrito((c) => ({ ...c, notas: evento.target.value }))
                }
                rows={2}
                maxLength={500}
                placeholder="Dirección, horario de entrega, indicaciones…"
                className={`py-2 ${CLASES_INPUT}`}
              />
            </label>
          ) : null}
        </div>

        <PanelCobro
          ref={panelCobro}
          refRecibido={campoRecibido}
          refBoton={botonCobrar}
          total={total}
          lineas={filas.length}
          metodoPago={metodoPago}
          onMetodo={(metodo) => {
            setErrorCobro(null);
            setMetodoElegido(metodo);
          }}
          motivoSinFiado={motivoSinFiado}
          recibido={recibido}
          onRecibido={setRecibido}
          vuelto={vuelto}
          credito={credito}
          esAdmin={esAdmin}
          motivoBloqueo={motivoBloqueo}
          enviando={enviando}
          error={errorCobro}
          onCobrar={() => void cobrar()}
        />
      </aside>

      {/* ------------------------------------------------- Diálogos */}
      <Dialogo
        abierto={exceso !== null}
        onCerrar={() => {
          setExceso(null);
          enfocarBuscador();
        }}
        titulo="La venta supera el límite de crédito"
      >
        {exceso ? (
          <div className="space-y-4">
            <dl className="cifras grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-tinta-media">Saldo actual</dt>
              <dd className="text-right">{formatoMoneda(exceso.saldo)}</dd>
              <dt className="text-tinta-media">Esta venta</dt>
              <dd className="text-right">{formatoMoneda(exceso.total)}</dd>
              <dt className="text-tinta-media">Límite</dt>
              <dd className="text-right">{formatoMoneda(exceso.limite)}</dd>
              <dt className="font-medium text-alerta-tinta">Exceso</dt>
              <dd className="text-right font-medium text-alerta-tinta">
                {formatoMoneda(exceso.exceso)}
              </dd>
            </dl>
            <p className="text-[12px] leading-relaxed text-tinta-media">
              Como administrador podés autorizarla igual. Queda cargada a la cuenta del cliente.
            </p>
            <div className="flex justify-end gap-2">
              <Boton
                variante="fantasma"
                data-autofocus
                onClick={() => {
                  setExceso(null);
                  enfocarBuscador();
                }}
              >
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                disabled={enviando}
                onClick={() => {
                  setExceso(null);
                  void cobrar(true);
                }}
              >
                Autorizar y cobrar
              </Boton>
            </div>
          </div>
        ) : null}
      </Dialogo>

      <ResultadoVenta resultado={resultado} onNuevaVenta={nuevaVenta} />
    </div>
  );
}
