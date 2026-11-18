import { Prisma, type UnidadVenta } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { textoCantidad, validarCantidad, validarCantidadContada } from "@/lib/calculos";
import { CANTIDAD_MAXIMA_COMPRA } from "@/lib/config";
import { prisma } from "@/lib/prisma";

import { resolverSucursalAjuste } from "./sucursal";
import {
  ErrorInventario,
  type AjusteAplicado,
  type PayloadConteo,
  type PayloadConteoLote,
  type PayloadMerma,
  type ResultadoConteoLote,
} from "./tipos";

/*
 * Ajustes de stock: conteo físico (fija la cantidad real) y merma (resta lo
 * que se pierde). Cada uno deja un `AjusteStock` con el stock anterior y el
 * resultante. Las cantidades siguen la regla de la unidad del producto y el
 * tope de una línea de compra.
 */

const MOTIVO_CONTEO = "Conteo físico";
const MINIMO_MOTIVO = 3;
const MAXIMO_MOTIVO = 500;
const MAXIMO_ITEMS_LOTE = 1000;

/** El lote fija el stock fila por fila: más margen que un ajuste suelto. */
const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 30_000 };

type Tx = Prisma.TransactionClient;
type ProductoAjuste = { id: number; nombre: string; unidadVenta: UnidadVenta };

// ------------------------------------------------------------ Validación

function invalido(mensaje: string): never {
  throw new ErrorInventario("PAYLOAD_INVALIDO", mensaje);
}

function esIdPositivo(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    valor <= 2_147_483_647
  );
}

function objeto(crudo: unknown): Record<string, unknown> {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    invalido("Los datos del ajuste no son válidos.");
  }
  return crudo as Record<string, unknown>;
}

function sucursalSolicitada(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (!esIdPositivo(valor)) invalido('"sucursalId" debe ser un id numérico o null.');
  return valor;
}

/** Motivo normalizado. Sin `obligatorio`, vacío devuelve `null`. */
export function validarMotivoAjuste(crudo: unknown, obligatorio: boolean): string | null {
  if (crudo !== null && crudo !== undefined && typeof crudo !== "string") {
    invalido('"motivo" debe ser texto.');
  }
  const motivo = typeof crudo === "string" ? crudo.trim().replace(/\s+/g, " ") : "";
  if (!motivo && !obligatorio) return null;
  if (motivo.length < MINIMO_MOTIVO || motivo.length > MAXIMO_MOTIVO) {
    throw new ErrorInventario(
      "MOTIVO_INVALIDO",
      obligatorio && !motivo
        ? "Escribí el motivo de la merma."
        : `El motivo debe tener entre ${MINIMO_MOTIVO} y ${MAXIMO_MOTIVO} caracteres.`,
    );
  }
  return motivo;
}

function cantidadCruda(valor: unknown, productoId: number): string {
  if (typeof valor !== "string") {
    throw new ErrorInventario("CANTIDAD_INVALIDA", 'La cantidad debe viajar como string.', {
      productoId,
    });
  }
  return valor.trim();
}

function exigirAdministrador(usuario: UsuarioActivo): void {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorInventario("SIN_PERMISO", "Solo el administrador puede ajustar el stock.");
  }
}

async function cargarProductos(ids: number[]): Promise<Map<number, ProductoAjuste>> {
  const productos = await prisma.producto.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, unidadVenta: true },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));
  for (const id of ids) {
    if (!porId.has(id)) {
      throw new ErrorInventario("PRODUCTO_NO_ENCONTRADO", "Un producto ya no existe. Recargá la página.", {
        productoId: id,
      });
    }
  }
  return porId;
}

function cantidadContada(texto: string, producto: ProductoAjuste): Prisma.Decimal {
  const r = validarCantidadContada(texto, producto.unidadVenta, CANTIDAD_MAXIMA_COMPRA);
  if (!r.valida) {
    throw new ErrorInventario("CANTIDAD_INVALIDA", `${producto.nombre}: ${r.mensaje}`, {
      productoId: producto.id,
    });
  }
  return r.cantidad;
}

// ------------------------------------------------------------ Escritura

/**
 * Fija el stock en la cantidad contada. La fila se bloquea con `FOR UPDATE`
 * antes de leer el stock anterior: una venta simultánea espera a que termine
 * el conteo (o el conteo a la venta), así la diferencia guardada es exacta.
 */
async function fijarStock(
  tx: Tx,
  productoId: number,
  sucursalId: number,
  contada: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  // Un producto que nunca tuvo movimientos todavía no tiene fila de stock.
  await tx.$executeRaw`
    INSERT INTO "Stock" ("productoId", "sucursalId", "cantidad")
    VALUES (${productoId}::int, ${sucursalId}::int, 0)
    ON CONFLICT ("productoId", "sucursalId") DO NOTHING`;

  const filas = await tx.$queryRaw<{ cantidad: Prisma.Decimal | string }[]>`
    SELECT "cantidad" FROM "Stock"
    WHERE "productoId" = ${productoId}::int AND "sucursalId" = ${sucursalId}::int
    FOR UPDATE`;
  const anterior = new Prisma.Decimal(filas[0]?.cantidad ?? 0);

  await tx.stock.update({
    where: { productoId_sucursalId: { productoId, sucursalId } },
    data: { cantidad: contada },
  });
  return anterior;
}

async function registrarAjuste(
  tx: Tx,
  datos: {
    producto: ProductoAjuste;
    sucursalId: number;
    usuarioId: number;
    tipo: "CONTEO" | "MERMA";
    cantidad: Prisma.Decimal;
    stockAnterior: Prisma.Decimal;
    stockResultante: Prisma.Decimal;
    motivo: string;
  },
): Promise<AjusteAplicado> {
  await tx.ajusteStock.create({
    data: {
      productoId: datos.producto.id,
      sucursalId: datos.sucursalId,
      usuarioId: datos.usuarioId,
      tipo: datos.tipo,
      cantidad: datos.cantidad,
      stockAnterior: datos.stockAnterior,
      stockResultante: datos.stockResultante,
      motivo: datos.motivo,
    },
  });
  return {
    productoId: datos.producto.id,
    nombre: datos.producto.nombre,
    unidadVenta: datos.producto.unidadVenta,
    tipo: datos.tipo,
    cantidad: textoCantidad(datos.cantidad),
    stockAnterior: textoCantidad(datos.stockAnterior),
    stockResultante: textoCantidad(datos.stockResultante),
  };
}

// ------------------------------------------------------------ Operaciones

/**
 * Conteo de un producto: el stock pasa a ser la cantidad contada y el ajuste
 * guarda la diferencia. Con diferencia 0 igual se registra, como constancia
 * de que se contó. Se permite sobre productos inactivos (para dejarlos en 0).
 */
export async function registrarConteo(
  usuario: UsuarioActivo,
  crudo: unknown,
): Promise<AjusteAplicado> {
  exigirAdministrador(usuario);
  const p = objeto(crudo);
  if (!esIdPositivo(p.productoId)) invalido('"productoId" debe ser un id numérico.');
  const payload: PayloadConteo = {
    productoId: p.productoId,
    sucursalId: sucursalSolicitada(p.sucursalId),
    cantidad: cantidadCruda(p.cantidad, p.productoId),
    motivo: validarMotivoAjuste(p.motivo, false),
  };

  const sucursal = await resolverSucursalAjuste(usuario, payload.sucursalId);
  const producto = (await cargarProductos([payload.productoId])).get(payload.productoId)!;
  const contada = cantidadContada(payload.cantidad, producto);

  return prisma.$transaction(async (tx) => {
    const anterior = await fijarStock(tx, producto.id, sucursal.id, contada);
    return registrarAjuste(tx, {
      producto,
      sucursalId: sucursal.id,
      usuarioId: usuario.id,
      tipo: "CONTEO",
      cantidad: contada.minus(anterior),
      stockAnterior: anterior,
      stockResultante: contada,
      motivo: payload.motivo ?? MOTIVO_CONTEO,
    });
  }, OPCIONES_TRANSACCION);
}

/**
 * Merma: resta la cantidad perdida con un `decrement` atómico. Puede dejar el
 * stock en negativo (la pantalla lo advierte antes de confirmar).
 */
export async function registrarMerma(
  usuario: UsuarioActivo,
  crudo: unknown,
): Promise<AjusteAplicado> {
  exigirAdministrador(usuario);
  const p = objeto(crudo);
  if (!esIdPositivo(p.productoId)) invalido('"productoId" debe ser un id numérico.');
  const payload: PayloadMerma = {
    productoId: p.productoId,
    sucursalId: sucursalSolicitada(p.sucursalId),
    cantidad: cantidadCruda(p.cantidad, p.productoId),
    motivo: validarMotivoAjuste(p.motivo, true)!,
  };

  const sucursal = await resolverSucursalAjuste(usuario, payload.sucursalId);
  const producto = (await cargarProductos([payload.productoId])).get(payload.productoId)!;
  const r = validarCantidad(payload.cantidad, producto.unidadVenta, CANTIDAD_MAXIMA_COMPRA);
  if (!r.valida) {
    throw new ErrorInventario("CANTIDAD_INVALIDA", r.mensaje, { productoId: producto.id });
  }
  const perdida = r.cantidad;

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.upsert({
      where: { productoId_sucursalId: { productoId: producto.id, sucursalId: sucursal.id } },
      update: { cantidad: { decrement: perdida } },
      create: { productoId: producto.id, sucursalId: sucursal.id, cantidad: perdida.neg() },
      select: { cantidad: true },
    });
    // El valor devuelto es el posterior al decremento, ya con el bloqueo de la
    // fila: el anterior se deduce sin otra lectura que pueda cruzarse.
    return registrarAjuste(tx, {
      producto,
      sucursalId: sucursal.id,
      usuarioId: usuario.id,
      tipo: "MERMA",
      cantidad: perdida.neg(),
      stockAnterior: stock.cantidad.plus(perdida),
      stockResultante: stock.cantidad,
      motivo: payload.motivo,
    });
  }, OPCIONES_TRANSACCION);
}

/**
 * Conteo por lote (modo conteo de la pantalla): un ajuste por producto
 * contado, todos en una sola transacción. Si uno falla, no se guarda ninguno.
 */
export async function registrarConteoLote(
  usuario: UsuarioActivo,
  crudo: unknown,
): Promise<Extract<ResultadoConteoLote, { ok: true }>> {
  exigirAdministrador(usuario);
  const p = objeto(crudo);
  if (!Array.isArray(p.items) || p.items.length === 0) invalido("No hay productos contados.");
  if (p.items.length > MAXIMO_ITEMS_LOTE) {
    invalido(`Máximo ${MAXIMO_ITEMS_LOTE} productos por conteo.`);
  }

  const vistos = new Set<number>();
  const payload: PayloadConteoLote = {
    sucursalId: sucursalSolicitada(p.sucursalId),
    motivo: validarMotivoAjuste(p.motivo, false),
    items: p.items.map((item: unknown) => {
      const i = objeto(item);
      if (!esIdPositivo(i.productoId)) invalido('Cada producto necesita un "productoId".');
      if (vistos.has(i.productoId)) {
        throw new ErrorInventario("PRODUCTO_REPETIDO", "Un producto aparece dos veces.", {
          productoId: i.productoId,
        });
      }
      vistos.add(i.productoId);
      return { productoId: i.productoId, cantidad: cantidadCruda(i.cantidad, i.productoId) };
    }),
  };

  const sucursal = await resolverSucursalAjuste(usuario, payload.sucursalId);
  const productos = await cargarProductos(payload.items.map((i) => i.productoId));
  const lineas = payload.items
    .map((item) => {
      const producto = productos.get(item.productoId)!;
      return { producto, contada: cantidadContada(item.cantidad, producto) };
    })
    // Mismo orden que ventas y compras, para no cruzar bloqueos de stock.
    .sort((a, b) => a.producto.id - b.producto.id);

  const motivo = payload.motivo ?? MOTIVO_CONTEO;

  const aplicados = await prisma.$transaction(async (tx) => {
    const resultado: AjusteAplicado[] = [];
    for (const { producto, contada } of lineas) {
      const anterior = await fijarStock(tx, producto.id, sucursal.id, contada);
      resultado.push(
        await registrarAjuste(tx, {
          producto,
          sucursalId: sucursal.id,
          usuarioId: usuario.id,
          tipo: "CONTEO",
          cantidad: contada.minus(anterior),
          stockAnterior: anterior,
          stockResultante: contada,
          motivo,
        }),
      );
    }
    return resultado;
  }, OPCIONES_TRANSACCION);

  return {
    ok: true,
    contados: aplicados.length,
    conDiferencia: aplicados.filter((a) => !new Prisma.Decimal(a.cantidad).isZero()),
  };
}
