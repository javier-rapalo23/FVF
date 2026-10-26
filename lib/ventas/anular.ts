import { Prisma } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import { ErrorVenta, type PayloadAnulacion } from "./tipos";

const MINIMO_MOTIVO = 3;
const MAXIMO_MOTIVO = 500;

export function validarPayloadAnulacion(crudo: unknown): PayloadAnulacion {
  const p = (typeof crudo === "object" && crudo !== null ? crudo : {}) as Record<
    string,
    unknown
  >;

  const motivo = typeof p.motivo === "string" ? p.motivo.trim().replace(/\s+/g, " ") : "";
  if (motivo.length < MINIMO_MOTIVO || motivo.length > MAXIMO_MOTIVO) {
    throw new ErrorVenta(
      "MOTIVO_INVALIDO",
      400,
      `El motivo debe tener entre ${MINIMO_MOTIVO} y ${MAXIMO_MOTIVO} caracteres.`,
    );
  }

  if (typeof p.reingresaStock !== "boolean") {
    throw new ErrorVenta(
      "PAYLOAD_INVALIDO",
      400,
      "Indicá si el producto vuelve al stock.",
    );
  }

  return { motivo, reingresaStock: p.reingresaStock };
}

/**
 * Anula una venta completa. Todo en una transacción:
 * 1. registro `AnulacionVenta`;
 * 2. `Venta.anulada = true`;
 * 3. si el producto vuelve físicamente, se reingresa el stock de cada línea
 *    en la sucursal de la venta;
 * 4. si era fiado, un movimiento `ANULACION` por el total (no `ABONO`: no es
 *    dinero cobrado, y el cierre de caja tiene que poder distinguirlo).
 *
 * La venta nunca se borra.
 */
export async function anularVenta(
  usuario: UsuarioActivo,
  ventaId: number,
  { motivo, reingresaStock }: PayloadAnulacion,
): Promise<{ ventaId: number; anulada: true }> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorVenta("SIN_PERMISO", 403, "Solo el administrador puede anular ventas.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        select: {
          id: true,
          sucursalId: true,
          clienteId: true,
          metodoPago: true,
          total: true,
          detalles: { select: { productoId: true, cantidad: true } },
        },
      });

      if (!venta) {
        throw new ErrorVenta("VENTA_NO_ENCONTRADA", 404, "La venta no existe.");
      }

      // El `where` con `anulada: false` toma el bloqueo de la fila: si dos
      // administradores anulan a la vez, el segundo ve 0 filas y no duplica
      // el reingreso de stock ni la reversa del fiado.
      const marcadas = await tx.venta.updateMany({
        where: { id: venta.id, anulada: false },
        data: { anulada: true },
      });
      if (marcadas.count === 0) {
        throw new ErrorVenta("VENTA_YA_ANULADA", 409, "La venta ya estaba anulada.");
      }

      await tx.anulacionVenta.create({
        data: { ventaId: venta.id, usuarioId: usuario.id, motivo, reingresaStock },
      });

      if (reingresaStock) {
        const entradas = new Map<number, Prisma.Decimal>();
        for (const detalle of venta.detalles) {
          entradas.set(
            detalle.productoId,
            (entradas.get(detalle.productoId) ?? new Prisma.Decimal(0)).plus(
              detalle.cantidad,
            ),
          );
        }

        // Mismo orden que el registro de ventas, para no cruzar bloqueos.
        for (const [productoId, cantidad] of [...entradas].sort(([a], [b]) => a - b)) {
          await tx.stock.upsert({
            where: { productoId_sucursalId: { productoId, sucursalId: venta.sucursalId } },
            update: { cantidad: { increment: cantidad } },
            create: { productoId, sucursalId: venta.sucursalId, cantidad },
          });
        }
      }

      if (venta.metodoPago === "FIADO" && venta.clienteId !== null) {
        await tx.movimientoCuenta.create({
          data: {
            clienteId: venta.clienteId,
            ventaId: venta.id,
            tipo: "ANULACION",
            monto: venta.total,
          },
        });
      }
    });
  } catch (error) {
    // Respaldo de la clave única de `AnulacionVenta.ventaId`.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErrorVenta("VENTA_YA_ANULADA", 409, "La venta ya estaba anulada.");
    }
    throw error;
  }

  return { ventaId, anulada: true };
}
