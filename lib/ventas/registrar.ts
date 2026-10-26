import { Prisma, type Canal, type MetodoPago } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import {
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
const MAXIMO_ITEMS = 200;
const MAXIMO_NOTAS = 500;

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
    return { productoId: i.productoId, cantidad: cantidad.cantidad.toString() };
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
  };
}

// -------------------------------------------------------------- Registro

/** Respuesta de una venta ya registrada con esa clave (reintento). */
async function ventaPorClave(claveIdempotencia: string): Promise<ResultadoRegistro | null> {
  const venta = await prisma.venta.findUnique({
    where: { claveIdempotencia },
    select: { id: true, total: true },
  });
  if (!venta) return null;

  return {
    http: 200,
    cuerpo: {
      ventaId: venta.id,
      total: textoMonto(venta.total),
      yaRegistrada: true,
      advertencias: [],
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
 * Registra una venta: valida reglas de canal, cliente y fiado, y en una sola
 * transacción crea la venta con su detalle, descuenta stock y, si es fiado,
 * carga el total a la cuenta del cliente.
 *
 * El servidor decide precios y totales; lo que mande el cliente se ignora.
 * El payload ya tiene que venir de `validarPayloadVenta`.
 */
export async function registrarVenta(
  usuario: UsuarioActivo,
  payload: PayloadVenta,
): Promise<ResultadoRegistro> {
  // 3. Idempotencia: un reintento devuelve la venta original sin tocar nada.
  const previa = await ventaPorClave(payload.claveIdempotencia);
  if (previa) return previa;

  // 4. Sucursal. Solo un administrador sin sucursal puede elegirla.
  const sucursal = await resolverSucursal(
    usuario,
    usuario.rol === "ADMINISTRADOR" ? payload.sucursalId : null,
  );

  // 5. Productos activos, cantidades según unidad y reglas de cliente.
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
    if (!producto?.activo) {
      throw new ErrorVenta(
        "PRODUCTO_NO_DISPONIBLE",
        422,
        producto
          ? `"${producto.nombre}" está desactivado y no se puede vender.`
          : "Uno de los productos ya no existe.",
        { productoId: id },
      );
    }
  }

  if (payload.clienteId === null) {
    if (payload.canal === "PEDIDO") {
      throw new ErrorVenta("CLIENTE_REQUERIDO", 422, "Un pedido necesita un cliente.");
    }
    if (payload.metodoPago === "FIADO") {
      throw new ErrorVenta(
        "CLIENTE_REQUERIDO",
        422,
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

  if (payload.clienteId !== null && !cliente?.activo) {
    throw new ErrorVenta(
      "CLIENTE_INACTIVO",
      422,
      cliente
        ? `${cliente.nombre} está desactivado.`
        : "El cliente elegido ya no existe.",
      { clienteId: payload.clienteId },
    );
  }

  if (payload.metodoPago === "FIADO" && cliente && !cliente.fiadoHabilitado) {
    throw new ErrorVenta(
      "FIADO_NO_HABILITADO",
      422,
      `${cliente.nombre} no tiene el fiado habilitado.`,
      { clienteId: cliente.id },
    );
  }

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

    const precioUnitario = precioSegunCliente(producto, cliente?.tipo);
    return {
      productoId: producto.id,
      cantidad: cantidad.cantidad,
      precioUnitario,
      subtotal: calcularSubtotal(cantidad.cantidad, precioUnitario),
    };
  });

  const total = calcularTotal(lineas.map((linea) => linea.subtotal));

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
      if (payload.metodoPago === "FIADO" && cliente && cliente.limiteCredito !== null) {
        const saldo = await saldoDeCliente(tx, cliente.id);
        const saldoFinal = saldo.plus(total);

        if (saldoFinal.gt(cliente.limiteCredito)) {
          const puedeConfirmar = usuario.rol === "ADMINISTRADOR";
          if (!(puedeConfirmar && payload.confirmarExcesoCredito)) {
            const datos: DatosExcesoCredito = {
              saldo: textoMonto(saldo),
              limite: textoMonto(cliente.limiteCredito),
              total: textoMonto(total),
              exceso: textoMonto(saldoFinal.minus(cliente.limiteCredito)),
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

      const venta = await tx.venta.create({
        data: {
          claveIdempotencia: payload.claveIdempotencia,
          canal: payload.canal,
          metodoPago: payload.metodoPago,
          clienteId: cliente?.id ?? null,
          usuarioId: usuario.id,
          sucursalId: sucursal.id,
          notas: payload.notas,
          total,
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
          data: { clienteId: cliente.id, ventaId: venta.id, tipo: "CARGO", monto: total },
        });
      }

      return {
        http: 201 as const,
        cuerpo: {
          ventaId: venta.id,
          total: textoMonto(total),
          yaRegistrada: false,
          advertencias,
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
