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
  aplicarPendientes,
  aplicarVenta,
  claveCatalogo,
  guardarCatalogo,
  leerCatalogo,
  type VentaLocal,
} from "@/lib/offline/catalogo-local";
import { encolarVenta, listarPendientes } from "@/lib/offline/cola";
import { emitir, escuchar, esFallaDeRed, reportarRed } from "@/lib/offline/eventos";
import type { RegistroCatalogo, ResumenVenta, VentaPendiente } from "@/lib/offline/tipos";
import {
  aDecimal,
  calcularSubtotal,
  calcularTotal,
  calcularVuelto,
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
import type { DatosComprobante } from "./comprobante";
import { comprobanteDePendiente, ImpresionAislada } from "./impresion-aislada";
import { LineasCarrito } from "./lineas-carrito";
import { PanelCobro, type ErrorCobro } from "./panel-cobro";
import { ResultadoVenta, type Resultado } from "./resultado-venta";
import { SelectorCliente } from "./selector-cliente";

/** El catálogo se refresca solo mientras haya conexión. */
const REFRESCO_CATALOGO_MS = 60_000;
const ESPERA_CATALOGO_MS = 10_000;
/** Sin respuesta en este tiempo, la venta se guarda sin conexión. */
const ESPERA_COBRO_MS = 8_000;
/** Respuestas de un servidor caído o inalcanzable detrás del proxy: se vende igual. */
const SERVIDOR_CAIDO = [502, 503, 504];

type Sucursal = { id: number; nombre: string };

/** Lo que hace falta de la venta en curso para cerrarla, online u offline. */
type Cierre = {
  payload: PayloadVenta;
  resumen: ResumenVenta;
  venta: VentaLocal;
  filas: FilaCarrito[];
  metodoPago: MetodoPago;
  clienteNombre: string | null;
  vuelto: Prisma.Decimal | null;
};

export function PantallaCaja({
  usuario,
  sucursales,
}: {
  usuario: { id: number; rol: Rol; nombre: string };
  /** Solo para un administrador sin sucursal asignada y con más de una para elegir. */
  sucursales: readonly Sucursal[];
}) {
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  // ------------------------------------------------------------ Catálogo
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [registro, setRegistro] = useState<RegistroCatalogo | null>(null);
  const [pendientes, setPendientes] = useState<VentaPendiente[]>([]);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  const necesitaSucursal = sucursales.length > 1 && sucursalId === null;
  const sucursalVigente = useRef(sucursalId);
  sucursalVigente.current = sucursalId;
  /** Momento del último cobro: un catálogo pedido antes llega con stock viejo. */
  const ultimaVenta = useRef(0);

  // Lo que se muestra: el catálogo del servidor (o el guardado) menos lo que
  // ya se vendió sin conexión y espera en la cola.
  const catalogo: Catalogo | null = useMemo(
    () => (registro ? aplicarPendientes(registro.catalogo, pendientes) : null),
    [registro, pendientes],
  );

  const claveActual = useCallback(
    () => claveCatalogo(usuario.id, sucursalVigente.current),
    [usuario.id],
  );

  /** Relee del dispositivo la cola y el catálogo guardado (los cambia el motor de sincronización). */
  const recargarLocal = useCallback(async () => {
    setPendientes(await listarPendientes());
    const guardado = await leerCatalogo(claveActual());
    if (guardado && guardado.clave === claveActual()) setRegistro(guardado);
  }, [claveActual]);

  const cargarCatalogo = useCallback(async () => {
    const pedidoEn = Date.now();
    const pedida = sucursalId;
    const clave = claveCatalogo(usuario.id, pedida);
    setCargandoCatalogo(true);

    try {
      const respuesta = await fetch(
        `/api/caja/catalogo${pedida !== null ? `?sucursalId=${pedida}` : ""}`,
        { cache: "no-store", signal: AbortSignal.timeout(ESPERA_CATALOGO_MS) },
      );
      reportarRed(true);
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | Catalogo
        | RespuestaError
        | null;

      if (pedida !== sucursalVigente.current) return;

      if (!respuesta.ok || !cuerpo || "error" in cuerpo) {
        if (respuesta.status === 401) emitir({ tipo: "sesion", vencida: true });
        setErrorCatalogo(
          (cuerpo && "mensaje" in cuerpo ? cuerpo.mensaje : null) ??
            "No se pudo cargar el catálogo.",
        );
        return;
      }

      if (pedidoEn < ultimaVenta.current) return;
      const nuevo: RegistroCatalogo = {
        clave,
        usuarioId: usuario.id,
        catalogo: cuerpo,
        obtenidoEn: pedidoEn,
      };
      await guardarCatalogo(nuevo);
      if (pedida !== sucursalVigente.current) return;
      setRegistro(nuevo);
      setErrorCatalogo(null);
    } catch (error) {
      if (esFallaDeRed(error)) reportarRed(false);

      // Sin red: el último catálogo guardado en el dispositivo.
      const guardado = await leerCatalogo(clave);
      if (pedida !== sucursalVigente.current) return;
      if (guardado) setRegistro((actual) => actual ?? guardado);
      setErrorCatalogo(
        guardado
          ? "Sin conexión: se vende con el catálogo guardado y las ventas se sincronizan al volver la red."
          : "Sin conexión y sin catálogo guardado en este dispositivo. Abrí la caja una vez con conexión.",
      );
    } finally {
      setCargandoCatalogo(false);
    }
  }, [sucursalId, usuario.id]);

  useEffect(() => {
    if (necesitaSucursal) return;

    // Lo guardado aparece al instante; el servidor lo reemplaza si responde.
    void recargarLocal();
    void cargarCatalogo();
    const intervalo = setInterval(() => {
      if (navigator.onLine) void cargarCatalogo();
    }, REFRESCO_CATALOGO_MS);
    return () => clearInterval(intervalo);
  }, [cargarCatalogo, recargarLocal, necesitaSucursal]);

  // La cola cambia desde el motor de sincronización (esta u otra pestaña).
  useEffect(
    () =>
      escuchar((evento) => {
        if (evento.tipo === "cola" || evento.tipo === "sincronizada") void recargarLocal();
      }),
    [recargarLocal],
  );

  function elegirSucursal(id: number) {
    setSucursalId(id);
    setRegistro(null);
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
  const [impresion, setImpresion] = useState<DatosComprobante | null>(null);

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
  const terminarImpresion = useCallback(() => setImpresion(null), []);

  // Al cargar, la búsqueda toma el foco en cuanto hay catálogo (antes está
  // deshabilitada): el primer escaneo ya cae en el campo correcto.
  const hayCatalogo = registro !== null;
  useEffect(() => {
    if (hayCatalogo) enfocarBuscador();
  }, [hayCatalogo, enfocarBuscador]);

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

    // El administrador confirma el exceso de crédito acá mismo, con los datos
    // del catálogo: así funciona también sin conexión. Si el servidor tiene
    // un saldo más nuevo, igual vuelve a preguntar.
    if (credito && esAdmin && !confirmarExcesoCredito) {
      setExceso({
        saldo: textoMonto(credito.saldo),
        limite: textoMonto(credito.limite),
        total: textoMonto(total),
        exceso: textoMonto(credito.exceso),
        puedeConfirmar: true,
      });
      return;
    }

    const items = filas.map((fila) => ({
      productoId: fila.linea.productoId,
      cantidad: fila.cantidad?.valida ? fila.cantidad.cantidad.toString() : "",
    }));

    const cierre: Cierre = {
      payload: {
        claveIdempotencia: carrito.claveIdempotencia,
        canal: carrito.canal,
        clienteId: carrito.clienteId,
        metodoPago,
        sucursalId: catalogo.sucursal.id,
        notas: carrito.canal === "PEDIDO" ? carrito.notas.trim() || null : null,
        confirmarExcesoCredito,
        items,
      },
      resumen: {
        sucursalNombre: catalogo.sucursal.nombre,
        usuarioNombre: usuario.nombre,
        clienteNombre: cliente?.nombre ?? null,
        total: textoMonto(total),
        lineas: filas.flatMap((fila) =>
          fila.producto && fila.cantidad?.valida && fila.precioUnitario && fila.subtotal
            ? [
                {
                  productoId: fila.producto.id,
                  nombre: fila.producto.nombre,
                  unidadVenta: fila.producto.unidadVenta,
                  cantidad: fila.cantidad.cantidad.toString(),
                  precioUnitario: textoMonto(fila.precioUnitario),
                  subtotal: textoMonto(fila.subtotal),
                },
              ]
            : [],
        ),
      },
      venta: { items, clienteId: carrito.clienteId, metodoPago, total: textoMonto(total) },
      filas,
      metodoPago,
      clienteNombre: cliente?.nombre ?? null,
      vuelto: vuelto && !vuelto.lt(0) ? vuelto : null,
    };

    enviandoRef.current = true;
    setEnviando(true);
    setErrorCobro(null);

    try {
      let respuesta: Response;
      try {
        respuesta = await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cierre.payload),
          signal: AbortSignal.timeout(ESPERA_COBRO_MS),
        });
      } catch {
        // Sin red o sin respuesta a tiempo: se cobra igual y se sincroniza
        // después. Si este envío sí llegó, la clave evita el duplicado.
        reportarRed(false);
        await guardarSinConexion(cierre);
        return;
      }

      reportarRed(true);
      if (SERVIDOR_CAIDO.includes(respuesta.status)) {
        await guardarSinConexion(cierre);
        return;
      }

      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaVenta
        | RespuestaError
        | null;

      if (respuesta.ok && cuerpo && !("error" in cuerpo)) {
        await ventaRegistrada(cuerpo, cierre);
        return;
      }

      const error = cuerpo && "error" in cuerpo ? cuerpo : null;
      if (error?.error === "LIMITE_CREDITO_EXCEDIDO" && error.puedeConfirmar) {
        setExceso(error as unknown as DatosExcesoCredito);
        return;
      }

      if (respuesta.status === 401) emitir({ tipo: "sesion", vencida: true });
      setErrorCobro({
        mensaje: error?.mensaje ?? `El servidor respondió con un error (${respuesta.status}).`,
        sesionVencida: respuesta.status === 401,
      });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  /** Descuenta la venta del catálogo guardado (y del que se ve). */
  async function asentarEnCatalogo(venta: VentaLocal) {
    ultimaVenta.current = Date.now();
    const base = (await leerCatalogo(claveActual())) ?? registro;
    if (!base) return;
    const nuevo = { ...base, catalogo: aplicarVenta(base.catalogo, venta) };
    await guardarCatalogo(nuevo);
    setRegistro(nuevo);
  }

  async function ventaRegistrada(venta: RespuestaVenta, cierre: Cierre) {
    setResultado({
      ventaId: venta.ventaId,
      total: venta.total,
      yaRegistrada: venta.yaRegistrada,
      advertencias: venta.advertencias,
      pendiente: null,
      metodoPago: cierre.metodoPago,
      clienteNombre: cierre.clienteNombre,
      vuelto: cierre.vuelto,
      productos: productosDe(cierre.filas),
    });
    reiniciarVenta();

    // Stock y saldo se actualizan en el momento; el refresco del catálogo
    // trae después los valores definitivos.
    if (!venta.yaRegistrada) await asentarEnCatalogo(cierre.venta);
  }

  async function guardarSinConexion(cierre: Cierre) {
    const fechaCliente = new Date().toISOString();
    const pendiente: VentaPendiente = {
      claveIdempotencia: cierre.payload.claveIdempotencia,
      payload: {
        ...cierre.payload,
        origenOffline: true,
        fechaCliente,
        usuarioIdOrigen: usuario.id,
        // Offline se guarda lo que pagó el cliente: el servidor lo respeta.
        items: cierre.resumen.lineas.map((linea) => ({
          productoId: linea.productoId,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
        })),
      },
      usuarioId: usuario.id,
      sucursalId: cierre.payload.sucursalId ?? 0,
      fechaCliente,
      estado: "PENDIENTE",
      intentos: 0,
      ultimoError: null,
      proximoIntento: 0,
      creadoEn: Date.now(),
      resumen: cierre.resumen,
    };

    try {
      await encolarVenta(pendiente);
    } catch {
      setErrorCobro({
        mensaje:
          "No hay conexión y este dispositivo no pudo guardar la venta. No se registró: reintentá cuando vuelva la red.",
      });
      return;
    }

    setPendientes((actuales) => [...actuales, pendiente]);
    setResultado({
      ventaId: null,
      total: cierre.resumen.total,
      yaRegistrada: false,
      advertencias: [],
      pendiente,
      metodoPago: cierre.metodoPago,
      clienteNombre: cierre.clienteNombre,
      vuelto: cierre.vuelto,
      productos: productosDe(cierre.filas),
    });
    reiniciarVenta();
  }

  /** La próxima venta arranca vacía y con una clave nueva. */
  function reiniciarVenta() {
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
            <span className="shrink-0">
              <Icono nombre="alerta" tamano={15} />
            </span>
            <span>
              {errorCatalogo}
              {catalogo
                ? ` Datos de las ${formatoHora(new Date(catalogo.generadoEn))}.`
                : ""}
            </span>
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

      <ResultadoVenta
        resultado={resultado}
        onNuevaVenta={nuevaVenta}
        onImprimirPendiente={(pendiente) => setImpresion(comprobanteDePendiente(pendiente))}
      />

      <ImpresionAislada datos={impresion} onTerminar={terminarImpresion} />
    </div>
  );
}

function productosDe(filas: readonly FilaCarrito[]) {
  return new Map(
    filas.flatMap((fila) =>
      fila.producto
        ? [
            [
              fila.producto.id,
              { nombre: fila.producto.nombre, unidadVenta: fila.producto.unidadVenta },
            ] as const,
          ]
        : [],
    ),
  );
}
