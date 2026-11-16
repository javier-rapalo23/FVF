import { Prisma, type CondicionPago } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import {
  calcularSubtotal,
  calcularTotal,
  textoMonto,
  validarCantidad,
  validarMontoPositivo,
} from "@/lib/calculos";
import { CANTIDAD_MAXIMA_COMPRA, DIAS_ATRAS_COMPRA } from "@/lib/config";
import { diaDelNegocio, esDiaValido, mediodiaDelDia, sumarDias } from "@/lib/fecha";
import { prisma } from "@/lib/prisma";

import { saldoDeProveedor } from "./saldo";
import {
  ErrorCompra,
  type ItemCompra,
  type PayloadCompra,
  type ResultadoRegistroCompra,
} from "./tipos";

const CONDICIONES = ["CONTADO", "CREDITO"] as const satisfies readonly CondicionPago[];
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMO_ITEMS = 200;
const MAXIMO_NOTAS = 500;
const MAXIMO_FACTURA = 60;
/** Tope de `Decimal(10,2)`. */
const TOTAL_MAXIMO = new Prisma.Decimal("99999999.99");

/** Margen de la transacción: sube stock y actualiza productos línea por línea. */
const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 15_000 };

// ------------------------------------------------------------ Validación

function invalido(mensaje: string): never {
  throw new ErrorCompra("PAYLOAD_INVALIDO", mensaje);
}

function esIdPositivo(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    valor <= 2_147_483_647
  );
}

function textoOpcional(valor: unknown, campo: string, maximo: number): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "string") invalido(`"${campo}" debe ser texto.`);
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (limpio.length > maximo) invalido(`"${campo}" admite hasta ${maximo} caracteres.`);
  return limpio || null;
}

/**
 * Estructura del payload. Las server actions son endpoints públicos: aunque
 * el formulario arme bien el objeto, acá se revisa todo de nuevo. La regla de
 * cantidad por unidad se completa al cargar los productos.
 */
export function validarPayloadCompra(crudo: unknown): PayloadCompra {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    invalido("Los datos de la compra no son válidos.");
  }
  const p = crudo as Record<string, unknown>;

  if (typeof p.claveIdempotencia !== "string" || !PATRON_UUID.test(p.claveIdempotencia)) {
    invalido('"claveIdempotencia" debe ser un UUID.');
  }
  if (!esIdPositivo(p.proveedorId)) {
    throw new ErrorCompra("PROVEEDOR_NO_ENCONTRADO", "Elegí el proveedor.");
  }
  if (p.sucursalId !== null && p.sucursalId !== undefined && !esIdPositivo(p.sucursalId)) {
    invalido('"sucursalId" debe ser un id numérico o null.');
  }
  if (typeof p.fecha !== "string" || !esDiaValido(p.fecha)) {
    throw new ErrorCompra("FECHA_INVALIDA", "Elegí una fecha válida.");
  }
  if (!CONDICIONES.includes(p.condicionPago as CondicionPago)) {
    throw new ErrorCompra("PAYLOAD_INVALIDO", "Elegí si la compra es de contado o a crédito.");
  }

  if (!Array.isArray(p.items) || p.items.length === 0) {
    invalido("La compra no tiene productos.");
  }
  if (p.items.length > MAXIMO_ITEMS) invalido(`Máximo ${MAXIMO_ITEMS} líneas por compra.`);

  const vistos = new Set<number>();
  const items: ItemCompra[] = p.items.map((item: unknown) => {
    const i = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    if (!esIdPositivo(i.productoId)) invalido('Cada línea necesita un "productoId" numérico.');
    const productoId = i.productoId;

    if (vistos.has(productoId)) {
      throw new ErrorCompra(
        "PRODUCTO_REPETIDO",
        "El mismo producto aparece dos veces: sumá las cantidades en una sola línea.",
        { productoId },
      );
    }
    vistos.add(productoId);

    if (typeof i.cantidad !== "string") invalido('Cada "cantidad" debe viajar como string.');
    const cantidad = validarCantidad(i.cantidad, undefined, CANTIDAD_MAXIMA_COMPRA);
    if (!cantidad.valida) {
      throw new ErrorCompra("CANTIDAD_INVALIDA", cantidad.mensaje, { productoId });
    }

    if (typeof i.costoUnitario !== "string") {
      invalido('Cada "costoUnitario" debe viajar como string.');
    }
    const costo = validarMontoPositivo(i.costoUnitario);
    if (!costo.valido) {
      throw new ErrorCompra("COSTO_INVALIDO", `Costo: ${costo.mensaje}`, { productoId });
    }

    let fechaVencimiento: string | null = null;
    if (i.fechaVencimiento !== null && i.fechaVencimiento !== undefined && i.fechaVencimiento !== "") {
      if (typeof i.fechaVencimiento !== "string" || !esDiaValido(i.fechaVencimiento)) {
        throw new ErrorCompra("FECHA_INVALIDA", "La fecha de vencimiento no es válida.", {
          productoId,
        });
      }
      fechaVencimiento = i.fechaVencimiento;
    }

    return {
      productoId,
      cantidad: cantidad.cantidad.toString(),
      costoUnitario: costo.monto.toString(),
      fechaVencimiento,
    };
  });

  return {
    claveIdempotencia: p.claveIdempotencia,
    proveedorId: p.proveedorId,
    sucursalId: (p.sucursalId as number | null | undefined) ?? null,
    fecha: p.fecha,
    numeroFactura: textoOpcional(p.numeroFactura, "numeroFactura", MAXIMO_FACTURA),
    condicionPago: p.condicionPago as CondicionPago,
    notas: textoOpcional(p.notas, "notas", MAXIMO_NOTAS),
    items,
  };
}

/** Día de la factura: ni futuro ni más viejo que `DIAS_ATRAS_COMPRA`. */
export function validarDiaCompra(dia: string, hoy: string = diaDelNegocio()): string | null {
  if (!esDiaValido(dia)) return "Elegí una fecha válida.";
  if (dia > hoy) return "La fecha de la compra no puede ser futura.";
  if (dia < sumarDias(hoy, -DIAS_ATRAS_COMPRA)) {
    return `La fecha no puede tener más de ${DIAS_ATRAS_COMPRA} días.`;
  }
  return null;
}

// ------------------------------------------------------------ Apoyo

/**
 * Sucursal de la compra: la del administrador si tiene una asignada; si no, la
 * elegida en pantalla; si hay una sola, esa sin preguntar.
 */
export async function resolverSucursalCompra(
  usuario: UsuarioActivo,
  solicitada: number | null,
): Promise<{ id: number; nombre: string }> {
  if (usuario.sucursalId !== null) {
    const propia = await prisma.sucursal.findUnique({
      where: { id: usuario.sucursalId },
      select: { id: true, nombre: true },
    });
    if (propia) return propia;
  }

  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: "asc" },
  });

  const elegida = sucursales.find((s) => s.id === solicitada);
  if (elegida) return elegida;
  if (sucursales.length === 1) return sucursales[0]!;

  throw new ErrorCompra(
    "SUCURSAL_REQUERIDA",
    sucursales.length === 0
      ? "No hay ninguna sucursal cargada."
      : "Elegí la sucursal a la que entra la mercadería.",
    { sucursales },
  );
}

async function compraPorClave(clave: string): Promise<ResultadoRegistroCompra | null> {
  const compra = await prisma.compra.findUnique({
    where: { claveIdempotencia: clave },
    select: {
      id: true,
      total: true,
      condicionPago: true,
      proveedorId: true,
      proveedor: { select: { nombre: true } },
    },
  });
  if (!compra) return null;

  return {
    ok: true,
    compraId: compra.id,
    total: textoMonto(compra.total),
    condicionPago: compra.condicionPago,
    yaRegistrada: true,
    saldoProveedor:
      compra.condicionPago === "CREDITO"
        ? textoMonto(await saldoDeProveedor(prisma, compra.proveedorId))
        : null,
    proveedor: compra.proveedor.nombre,
  };
}

function esClaveDuplicada(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("claveIdempotencia")
  );
}

// ------------------------------------------------------------ Registro

/**
 * Registra una compra. Pasos:
 * 1. permiso y estructura del payload;
 * 2. idempotencia: si la clave ya existe, se devuelve esa compra;
 * 3. sucursal, fecha, proveedor y productos contra la base;
 * 4. el servidor recalcula subtotales y total;
 * 5. en una transacción: compra con su detalle, stock que sube, último costo
 *    (y vencimiento si se indicó) y, si es a crédito, el cargo al proveedor.
 */
export async function registrarCompra(
  usuario: UsuarioActivo,
  crudo: unknown,
): Promise<ResultadoRegistroCompra> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCompra("SIN_PERMISO", "Solo el administrador puede registrar compras.");
  }

  const payload = validarPayloadCompra(crudo);

  const existente = await compraPorClave(payload.claveIdempotencia);
  if (existente) return existente;

  const errorFecha = validarDiaCompra(payload.fecha);
  if (errorFecha) throw new ErrorCompra("FECHA_INVALIDA", errorFecha);

  const sucursal = await resolverSucursalCompra(usuario, payload.sucursalId);

  const proveedor = await prisma.proveedor.findUnique({
    where: { id: payload.proveedorId },
    select: { id: true, nombre: true, activo: true },
  });
  if (!proveedor) throw new ErrorCompra("PROVEEDOR_NO_ENCONTRADO", "El proveedor no existe.");
  if (!proveedor.activo) {
    throw new ErrorCompra(
      "PROVEEDOR_INACTIVO",
      `${proveedor.nombre} está inactivo. Reactivalo antes de cargarle compras.`,
    );
  }

  const productos = await prisma.producto.findMany({
    where: { id: { in: payload.items.map((i) => i.productoId) } },
    select: { id: true, nombre: true, unidadVenta: true, activo: true },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  const lineas = payload.items.map((item) => {
    const producto = porId.get(item.productoId);
    if (!producto) {
      throw new ErrorCompra("PRODUCTO_NO_ENCONTRADO", "Un producto de la compra ya no existe.", {
        productoId: item.productoId,
      });
    }
    if (!producto.activo) {
      throw new ErrorCompra(
        "PRODUCTO_INACTIVO",
        `${producto.nombre} está inactivo. Reactivalo antes de comprarlo.`,
        { productoId: producto.id },
      );
    }

    const cantidad = validarCantidad(item.cantidad, producto.unidadVenta, CANTIDAD_MAXIMA_COMPRA);
    if (!cantidad.valida) {
      throw new ErrorCompra("CANTIDAD_INVALIDA", `${producto.nombre}: ${cantidad.mensaje}`, {
        productoId: producto.id,
      });
    }

    const costoUnitario = new Prisma.Decimal(item.costoUnitario);
    return {
      productoId: producto.id,
      cantidad: cantidad.cantidad,
      costoUnitario,
      subtotal: calcularSubtotal(cantidad.cantidad, costoUnitario),
      fechaVencimiento: item.fechaVencimiento
        ? new Date(`${item.fechaVencimiento}T00:00:00.000Z`)
        : null,
    };
  });

  const total = calcularTotal(lineas.map((l) => l.subtotal));
  if (total.gt(TOTAL_MAXIMO)) {
    throw new ErrorCompra("COSTO_INVALIDO", "El total de la compra es demasiado alto.");
  }

  const fecha = mediodiaDelDia(payload.fecha);
  // Mismo orden que la caja: así una venta y una compra simultáneas toman los
  // bloqueos de stock en el mismo orden y no se traban entre sí.
  const ordenadas = [...lineas].sort((a, b) => a.productoId - b.productoId);

  try {
    return await prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          claveIdempotencia: payload.claveIdempotencia,
          fecha,
          proveedorId: proveedor.id,
          usuarioId: usuario.id,
          sucursalId: sucursal.id,
          total,
          numeroFactura: payload.numeroFactura,
          condicionPago: payload.condicionPago,
          notas: payload.notas,
          detalles: {
            create: lineas.map((linea) => ({
              productoId: linea.productoId,
              cantidad: linea.cantidad,
              costoUnitario: linea.costoUnitario,
              subtotal: linea.subtotal,
            })),
          },
        },
        select: { id: true },
      });

      for (const linea of ordenadas) {
        // Atómico y sin fallar si el producto todavía no tiene fila de stock.
        await tx.stock.upsert({
          where: {
            productoId_sucursalId: { productoId: linea.productoId, sucursalId: sucursal.id },
          },
          update: { cantidad: { increment: linea.cantidad } },
          create: {
            productoId: linea.productoId,
            sucursalId: sucursal.id,
            cantidad: linea.cantidad,
          },
        });

        await tx.producto.update({
          where: { id: linea.productoId },
          data: {
            costoActual: linea.costoUnitario,
            ...(linea.fechaVencimiento ? { fechaVencimiento: linea.fechaVencimiento } : {}),
          },
        });
      }

      let saldoProveedor: string | null = null;
      if (payload.condicionPago === "CREDITO") {
        await tx.movimientoProveedor.create({
          data: {
            proveedorId: proveedor.id,
            compraId: compra.id,
            tipo: "CARGO",
            monto: total,
            fecha,
          },
        });
        saldoProveedor = textoMonto(await saldoDeProveedor(tx, proveedor.id));
      }

      return {
        ok: true as const,
        compraId: compra.id,
        total: textoMonto(total),
        condicionPago: payload.condicionPago,
        yaRegistrada: false,
        saldoProveedor,
        proveedor: proveedor.nombre,
      };
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    // Dos envíos llegaron a la vez: el segundo choca con la clave única.
    if (esClaveDuplicada(error)) {
      const original = await compraPorClave(payload.claveIdempotencia);
      if (original) return original;
    }
    throw error;
  }
}
