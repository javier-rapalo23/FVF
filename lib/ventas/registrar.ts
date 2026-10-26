import { Prisma, type Canal, type MetodoPago } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { formatoMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import {
  aDecimal,
  calcularSubtotal,
  calcularTotal,
  textoCantidad,
  textoMonto,
  validarCantidad,
} from "./calculos";
import { precioSegunCliente } from "./precios";
import { saldoDeCliente } from "./saldo";
import { resolverSucursal } from "./sucursal";
import {
  ErrorVenta,
  type AdvertenciaVenta,
  type DatosExcesoCredito,
  type ItemVenta,
  type PayloadVenta,
  type RespuestaVenta,
} from "./tipos";

const CANALES = ["LOCAL", "PEDIDO"] as const satisfies readonly Canal[];
const METODOS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "FIADO",
] as const satisfies readonly MetodoPago[];

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Precio de una venta offline: monto con hasta 2 decimales, dentro de `Decimal(10,2)`. */
const PATRON_PRECIO = /^\d{1,8}(\.\d{1,2})?$/;
const MAXIMO_ITEMS = 200;
const MAXIMO_NOTAS = 500;

/** Ventana aceptada para la hora del dispositivo en una venta offline. */
const FECHA_CLIENTE_ATRAS_MS = 7 * 24 * 60 * 60 * 1000;
const FECHA_CLIENTE_ADELANTE_MS = 5 * 60 * 1000;

/**
 * Margen de la transacción: descuenta stock línea por línea contra una base
 * remota, y el valor por defecto de Prisma (5 s) queda corto en un carrito
 * grande.
 */
const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 15_000 };

export type ResultadoRegistro = { http: 200 | 201; cuerpo: RespuestaVenta };

// ------------------------------------------------------------ Validación

function invalido(mensaje: string): never {
  throw new ErrorVenta("PAYLOAD_INVALIDO", 400, mensaje);
}

/** Id de la base: entero positivo dentro del rango de un INT de Postgres. */
function esIdPositivo(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    valor <= 2_147_483_647
  );
}

function idOpcional(valor: unknown, campo: string): number | null {
  if (valor === null || valor === undefined) return null;
  if (!esIdPositivo(valor)) invalido(`"${campo}" debe ser un id numérico o null.`);
  return valor;
}

/**
 * Paso 2: estructura del payload y forma general de las cantidades. La regla
 * por unidad (entero o hasta 3 decimales) se completa al cargar los productos.
 */
export function validarPayloadVenta(crudo: unknown): PayloadVenta {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    invalido("El cuerpo de la petición debe ser un objeto JSON.");
  }
  const p = crudo as Record<string, unknown>;

  if (typeof p.claveIdempotencia !== "string" || !PATRON_UUID.test(p.claveIdempotencia)) {
    invalido('"claveIdempotencia" debe ser un UUID.');
  }
  if (!CANALES.includes(p.canal as Canal)) invalido('"canal" debe ser LOCAL o PEDIDO.');
  if (!METODOS.includes(p.metodoPago as MetodoPago)) {
    invalido('"metodoPago" debe ser EFECTIVO, TRANSFERENCIA, TARJETA o FIADO.');
  }

  let notas: string | null = null;
  if (p.notas !== null && p.notas !== undefined) {
    if (typeof p.notas !== "string") invalido('"notas" debe ser texto.');
    notas = p.notas.trim() || null;
    if (notas && notas.length > MAXIMO_NOTAS) {
      invalido(`"notas" admite hasta ${MAXIMO_NOTAS} caracteres.`);
    }
  }

  if (
    p.confirmarExcesoCredito !== undefined &&
    typeof p.confirmarExcesoCredito !== "boolean"
  ) {
    invalido('"confirmarExcesoCredito" debe ser true o false.');
  }

  if (p.origenOffline !== undefined && typeof p.origenOffline !== "boolean") {
    invalido('"origenOffline" debe ser true o false.');
  }
  const offline = p.origenOffline === true;

  if (offline) {
    if (typeof p.fechaCliente !== "string" || Number.isNaN(Date.parse(p.fechaCliente))) {
      invalido('Una venta offline necesita "fechaCliente" en formato ISO.');
    }
    if (!esIdPositivo(p.usuarioIdOrigen)) {
      invalido('Una venta offline necesita "usuarioIdOrigen".');
    }
  }

  if (!Array.isArray(p.items) || p.items.length === 0) {
    invalido("La venta no tiene productos.");
  }
  if (p.items.length > MAXIMO_ITEMS) invalido(`Máximo ${MAXIMO_ITEMS} líneas por venta.`);

  const items: ItemVenta[] = p.items.map((item: unknown) => {
    const i = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    if (!esIdPositivo(i.productoId)) invalido('Cada línea necesita un "productoId" numérico.');
    if (typeof i.cantidad !== "string") {
      invalido('Cada "cantidad" debe viajar como string, ej. "2.500".');
    }

    const cantidad = validarCantidad(i.cantidad);
    if (!cantidad.valida) {
      throw new ErrorVenta("CANTIDAD_INVALIDA", 400, cantidad.mensaje, {
        productoId: i.productoId,
      });
    }

    // En una venta online el precio lo decide el servidor: si viene, se ignora.
    if (!offline) return { productoId: i.productoId, cantidad: cantidad.cantidad.toString() };

    if (typeof i.precioUnitario !== "string" || !PATRON_PRECIO.test(i.precioUnitario)) {
      invalido('En una venta offline cada línea necesita "precioUnitario", ej. "18.00".');
    }
    return {
      productoId: i.productoId,
      cantidad: cantidad.cantidad.toString(),
      precioUnitario: i.precioUnitario,
    };
  });

  return {
    claveIdempotencia: p.claveIdempotencia.toLowerCase(),
    canal: p.canal as Canal,
    clienteId: idOpcional(p.clienteId, "clienteId"),
    metodoPago: p.metodoPago as MetodoPago,
    sucursalId: idOpcional(p.sucursalId, "sucursalId"),
    notas,
    confirmarExcesoCredito: p.confirmarExcesoCredito === true,
    items,
    ...(offline
      ? {
          origenOffline: true,
          fechaCliente: p.fechaCliente as string,
          usuarioIdOrigen: p.usuarioIdOrigen as number,
        }
      : {}),
  };
}

// -------------------------------------------------------------- Registro

/** Respuesta de una venta ya registrada con esa clave (reintento). */
async function ventaPorClave(claveIdempotencia: string): Promise<ResultadoRegistro | null> {
  const venta = await prisma.venta.findUnique({
    where: { claveIdempotencia },
    select: { id: true, total: true, requiereRevision: true },
  });
  if (!venta) return null;

  return {
    http: 200,
    cuerpo: {
      ventaId: venta.id,
      total: textoMonto(venta.total),
      yaRegistrada: true,
      advertencias: [],
      requiereRevision: venta.requiereRevision,
    },
  };
}

function esClaveDuplicada(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("claveIdempotencia")
  );
}

/**
 * Quién vendió. En una venta online, el usuario de la sesión. En una offline,
 * `usuarioIdOrigen`: si sincroniza otra persona, solo se acepta cuando es
 * administrador; un empleado no puede registrar ventas a nombre de otro.
 */
async function resolverVendedor(
  usuario: UsuarioActivo,
  payload: PayloadVenta,
  observaciones: string[],
): Promise<UsuarioActivo> {
  if (!payload.origenOffline || payload.usuarioIdOrigen === usuario.id) return usuario;

  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorVenta(
      "SIN_PERMISO",
      403,
      "Esta venta la cobró otro vendedor: la tiene que sincronizar él o un administrador.",
    );
  }

  const origen = await prisma.usuario.findUnique({
    where: { id: payload.usuarioIdOrigen },
    select: { id: true, nombre: true, rol: true, sucursalId: true, activo: true },
  });
  if (!origen) invalido("El vendedor de la venta ya no existe.");
  if (!origen.activo) observaciones.push(`El vendedor ${origen.nombre} está desactivado.`);

  return { id: origen.id, nombre: origen.nombre, rol: origen.rol, sucursalId: origen.sucursalId };
}

/**
 * Registra una venta: valida reglas de canal, cliente y fiado, y en una sola
 * transacción crea la venta con su detalle, descuenta stock y, si es fiado,
 * carga el total a la cuenta del cliente.
 *
 * Online, el servidor decide precios y totales y una regla incumplida rechaza
 * la venta. Offline (`origenOffline`), la venta ya ocurrió: se acepta el
 * precio que pagó el cliente y las reglas que dependen del estado actual
 * (producto o cliente desactivado, fiado, límite, precio, fecha) solo la
 * marcan para revisión. Siguen siendo errores duros los datos que no existen,
 * las cantidades inválidas y la falta de sucursal.
 *
 * El payload ya tiene que venir de `validarPayloadVenta`.
 */
export async function registrarVenta(
  usuario: UsuarioActivo,
  payload: PayloadVenta,
): Promise<ResultadoRegistro> {
  const offline = payload.origenOffline === true;
  const observaciones: string[] = [];

  /** Regla que depende del estado actual: online rechaza, offline anota. */
  function reglaBlanda(error: ErrorVenta, observacion: string) {
    if (!offline) throw error;
    observaciones.push(observacion);
  }

  /** Dato que no existe: online es 422, offline 400 (la venta queda en ERROR en la cola). */
  const httpInexistente = offline ? 400 : 422;

  // 1. Vendedor (en offline puede no ser el de la sesión).
  const vendedor = await resolverVendedor(usuario, payload, observaciones);

  // 3. Idempotencia: un reintento devuelve la venta original sin tocar nada.
  const previa = await ventaPorClave(payload.claveIdempotencia);
  if (previa) return previa;

  // 4. Sucursal del vendedor. Solo un administrador sin sucursal puede elegirla.
  const sucursal = await resolverSucursal(
    vendedor,
    vendedor.rol === "ADMINISTRADOR" ? payload.sucursalId : null,
  );

  // 5. Productos, cantidades según unidad y reglas de cliente.
  const idsProducto = [...new Set(payload.items.map((item) => item.productoId))];
  const productos = await prisma.producto.findMany({
    where: { id: { in: idsProducto } },
    select: {
      id: true,
      nombre: true,
      unidadVenta: true,
      precioMinorista: true,
      precioMayorista: true,
      activo: true,
    },
  });
  const productoPorId = new Map(productos.map((producto) => [producto.id, producto]));

  for (const id of idsProducto) {
    const producto = productoPorId.get(id);
    if (!producto) {
      throw new ErrorVenta(
        "PRODUCTO_NO_DISPONIBLE",
        httpInexistente,
        "Uno de los productos ya no existe.",
        { productoId: id },
      );
    }
    if (!producto.activo) {
      reglaBlanda(
        new ErrorVenta(
          "PRODUCTO_NO_DISPONIBLE",
          422,
          `"${producto.nombre}" está desactivado y no se puede vender.`,
          { productoId: id },
        ),
        `"${producto.nombre}" estaba desactivado al sincronizar.`,
      );
    }
  }

  // Pedido y fiado sin cliente son errores de la venta en sí, no del estado
  // actual: la caja offline tampoco los permite.
  if (payload.clienteId === null) {
    if (payload.canal === "PEDIDO") {
      throw new ErrorVenta("CLIENTE_REQUERIDO", httpInexistente, "Un pedido necesita un cliente.");
    }
    if (payload.metodoPago === "FIADO") {
      throw new ErrorVenta(
        "CLIENTE_REQUERIDO",
        httpInexistente,
        "Para vender fiado hay que elegir el cliente.",
      );
    }
  }

  const cliente =
    payload.clienteId === null
      ? null
      : await prisma.cliente.findUnique({
          where: { id: payload.clienteId },
          select: {
            id: true,
            nombre: true,
            tipo: true,
            activo: true,
            fiadoHabilitado: true,
            limiteCredito: true,
          },
        });

  if (payload.clienteId !== null && !cliente) {
    throw new ErrorVenta("CLIENTE_INACTIVO", httpInexistente, "El cliente elegido ya no existe.", {
      clienteId: payload.clienteId,
    });
  }

  if (cliente && !cliente.activo) {
    reglaBlanda(
      new ErrorVenta("CLIENTE_INACTIVO", 422, `${cliente.nombre} está desactivado.`, {
        clienteId: cliente.id,
      }),
      `El cliente ${cliente.nombre} estaba desactivado al sincronizar.`,
    );
  }

  if (payload.metodoPago === "FIADO" && cliente && !cliente.fiadoHabilitado) {
    reglaBlanda(
      new ErrorVenta(
        "FIADO_NO_HABILITADO",
        422,
        `${cliente.nombre} no tiene el fiado habilitado.`,
        { clienteId: cliente.id },
      ),
      `Venta fiado a ${cliente.nombre}, que ya no tiene el fiado habilitado.`,
    );
  }

  const preciosDistintos = new Set<string>();
  const lineas = payload.items.map((item) => {
    const producto = productoPorId.get(item.productoId)!;
    const cantidad = validarCantidad(item.cantidad, producto.unidadVenta);
    if (!cantidad.valida) {
      throw new ErrorVenta(
        "CANTIDAD_INVALIDA",
        400,
        `${producto.nombre}: ${cantidad.mensaje}`,
        { productoId: producto.id },
      );
    }

    // Offline se respeta lo que pagó el cliente; si no coincide con ninguno
    // de los precios vigentes, se marca.
    let precioUnitario = precioSegunCliente(producto, cliente?.tipo);
    if (offline && item.precioUnitario !== undefined) {
      precioUnitario = aDecimal(item.precioUnitario);
      if (
        !precioUnitario.eq(producto.precioMinorista) &&
        !precioUnitario.eq(producto.precioMayorista)
      ) {
        preciosDistintos.add(`${producto.nombre} (${formatoMoneda(precioUnitario)})`);
      }
    }

    return {
      productoId: producto.id,
      cantidad: cantidad.cantidad,
      precioUnitario,
      subtotal: calcularSubtotal(cantidad.cantidad, precioUnitario),
    };
  });

  if (preciosDistintos.size > 0) {
    observaciones.push(`Precio distinto al vigente: ${[...preciosDistintos].join(", ")}.`);
  }

  const total = calcularTotal(lineas.map((linea) => linea.subtotal));

  // Fecha: la del dispositivo, si es razonable; si no, la del servidor.
  let fecha: Date | undefined;
  if (offline && payload.fechaCliente) {
    const ahora = Date.now();
    const delCliente = new Date(payload.fechaCliente);
    const diferencia = delCliente.getTime() - ahora;
    if (diferencia < -FECHA_CLIENTE_ATRAS_MS || diferencia > FECHA_CLIENTE_ADELANTE_MS) {
      observaciones.push(
        `La hora del dispositivo (${payload.fechaCliente}) estaba fuera de rango; se usó la del servidor.`,
      );
    } else {
      fecha = delCliente;
    }
  }

  // Lo que sale de cada producto, sumando las líneas repetidas (dos pesadas).
  // Se descuenta en orden de id para que dos ventas simultáneas tomen los
  // bloqueos de stock en el mismo orden y no se trabe una con la otra.
  const salidas = new Map<number, Prisma.Decimal>();
  for (const linea of lineas) {
    salidas.set(
      linea.productoId,
      (salidas.get(linea.productoId) ?? new Prisma.Decimal(0)).plus(linea.cantidad),
    );
  }
  const salidasOrdenadas = [...salidas].sort(([a], [b]) => a - b);

  // 6. Todo o nada.
  try {
    return await prisma.$transaction(async (tx) => {
      const notasRevision = [...observaciones];

      if (payload.metodoPago === "FIADO" && cliente && cliente.limiteCredito !== null) {
        const saldo = await saldoDeCliente(tx, cliente.id);
        const saldoFinal = saldo.plus(total);

        if (saldoFinal.gt(cliente.limiteCredito)) {
          const exceso = saldoFinal.minus(cliente.limiteCredito);
          if (offline) {
            notasRevision.push(
              `Supera el límite de crédito de ${cliente.nombre} por ${formatoMoneda(exceso)} ` +
                `(saldo previo ${formatoMoneda(saldo)}, límite ${formatoMoneda(cliente.limiteCredito)}).`,
            );
          } else {
            const puedeConfirmar = usuario.rol === "ADMINISTRADOR";
            if (!(puedeConfirmar && payload.confirmarExcesoCredito)) {
              const datos: DatosExcesoCredito = {
                saldo: textoMonto(saldo),
                limite: textoMonto(cliente.limiteCredito),
                total: textoMonto(total),
                exceso: textoMonto(exceso),
                puedeConfirmar,
              };
              throw new ErrorVenta(
                "LIMITE_CREDITO_EXCEDIDO",
                422,
                `La venta supera el límite de crédito de ${cliente.nombre}.`,
                datos,
              );
            }
          }
        }
      }

      const requiereRevision = notasRevision.length > 0;

      const venta = await tx.venta.create({
        data: {
          claveIdempotencia: payload.claveIdempotencia,
          canal: payload.canal,
          metodoPago: payload.metodoPago,
          clienteId: cliente?.id ?? null,
          usuarioId: vendedor.id,
          sucursalId: sucursal.id,
          notas: payload.notas,
          total,
          ...(fecha ? { fecha } : {}),
          origenOffline: offline,
          requiereRevision,
          observacionSync: requiereRevision ? notasRevision.join(" ") : null,
          detalles: {
            create: lineas.map((linea) => ({
              productoId: linea.productoId,
              cantidad: linea.cantidad,
              precioUnitario: linea.precioUnitario,
              subtotal: linea.subtotal,
            })),
          },
        },
        select: { id: true },
      });

      const advertencias: AdvertenciaVenta[] = [];
      for (const [productoId, cantidad] of salidasOrdenadas) {
        // Atómico y sin fallar si el producto todavía no tiene fila de stock.
        const stock = await tx.stock.upsert({
          where: { productoId_sucursalId: { productoId, sucursalId: sucursal.id } },
          update: { cantidad: { decrement: cantidad } },
          create: { productoId, sucursalId: sucursal.id, cantidad: cantidad.neg() },
          select: { cantidad: true },
        });

        // Vender sin stock se permite: solo se avisa.
        if (stock.cantidad.lt(0)) {
          advertencias.push({
            tipo: "STOCK_NEGATIVO",
            productoId,
            stockResultante: textoCantidad(stock.cantidad),
          });
        }
      }

      if (payload.metodoPago === "FIADO" && cliente) {
        await tx.movimientoCuenta.create({
          data: {
            clienteId: cliente.id,
            ventaId: venta.id,
            tipo: "CARGO",
            monto: total,
            ...(fecha ? { fecha } : {}),
          },
        });
      }

      return {
        http: 201 as const,
        cuerpo: {
          ventaId: venta.id,
          total: textoMonto(total),
          yaRegistrada: false,
          advertencias,
          requiereRevision,
        },
      };
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    // 7. Dos reintentos llegaron a la vez: el segundo choca con la clave única.
    if (esClaveDuplicada(error)) {
      const original = await ventaPorClave(payload.claveIdempotencia);
      if (original) return original;
    }
    throw error;
  }
}
