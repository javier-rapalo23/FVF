import { Prisma } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { textoCantidad } from "@/lib/calculos";
import { prisma } from "@/lib/prisma";

import { ErrorCompra, type ResultadoAnulacionCompra } from "./tipos";

const MINIMO_MOTIVO = 5;
const MAXIMO_MOTIVO = 500;

export function validarMotivoAnulacion(crudo: unknown): string {
  const motivo = typeof crudo === "string" ? crudo.trim().replace(/\s+/g, " ") : "";
  if (motivo.length < MINIMO_MOTIVO || motivo.length > MAXIMO_MOTIVO) {
    throw new ErrorCompra(
      "MOTIVO_INVALIDO",
      `El motivo debe tener entre ${MINIMO_MOTIVO} y ${MAXIMO_MOTIVO} caracteres.`,
    );
  }
  return motivo;
}

/**
 * Anula una compra completa. Todo en una transacción:
 * 1. `AnulacionCompra` y `Compra.anulada = true`;
 * 2. se resta del stock lo que sumó cada línea (puede quedar negativo si la
 *    mercadería ya se vendió: se permite y se avisa);
 * 3. si era a crédito, un movimiento `ANULACION` por el total (no `PAGO`: no
 *    es dinero entregado).
 *
 * El último costo del producto no se recalcula. La compra nunca se borra.
 */
export async function anularCompra(
  usuario: UsuarioActivo,
  compraId: number,
  motivoCrudo: unknown,
): Promise<ResultadoAnulacionCompra> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCompra("SIN_PERMISO", "Solo el administrador puede anular compras.");
  }
  const motivo = validarMotivoAnulacion(motivoCrudo);

  try {
    return await prisma.$transaction(async (tx) => {
      const compra = await tx.compra.findUnique({
        where: { id: compraId },
        select: {
          id: true,
          sucursalId: true,
          proveedorId: true,
          condicionPago: true,
          total: true,
          detalles: { select: { productoId: true, cantidad: true } },
        },
      });
      if (!compra) throw new ErrorCompra("COMPRA_NO_ENCONTRADA", "La compra no existe.");

      // El `where` con `anulada: false` toma el bloqueo de la fila: si dos
      // administradores anulan a la vez, el segundo ve 0 filas y no resta el
      // stock dos veces.
      const marcadas = await tx.compra.updateMany({
        where: { id: compra.id, anulada: false },
        data: { anulada: true },
      });
      if (marcadas.count === 0) {
        throw new ErrorCompra("YA_ANULADA", "La compra ya estaba anulada.");
      }

      await tx.anulacionCompra.create({
        data: { compraId: compra.id, usuarioId: usuario.id, motivo },
      });

      const salidas = new Map<number, Prisma.Decimal>();
      for (const detalle of compra.detalles) {
        salidas.set(
          detalle.productoId,
          (salidas.get(detalle.productoId) ?? new Prisma.Decimal(0)).plus(detalle.cantidad),
        );
      }

      const negativos: number[] = [];
      // Mismo orden que ventas y compras, para no cruzar bloqueos.
      for (const [productoId, cantidad] of [...salidas].sort(([a], [b]) => a - b)) {
        const stock = await tx.stock.upsert({
          where: { productoId_sucursalId: { productoId, sucursalId: compra.sucursalId } },
          update: { cantidad: { decrement: cantidad } },
          create: { productoId, sucursalId: compra.sucursalId, cantidad: cantidad.neg() },
          select: { cantidad: true },
        });
        if (stock.cantidad.lt(0)) negativos.push(productoId);
      }

      if (compra.condicionPago === "CREDITO") {
        await tx.movimientoProveedor.create({
          data: {
            proveedorId: compra.proveedorId,
            compraId: compra.id,
            tipo: "ANULACION",
            monto: compra.total,
          },
        });
      }

      const stockNegativo =
        negativos.length === 0
          ? []
          : (
              await tx.stock.findMany({
                where: { sucursalId: compra.sucursalId, productoId: { in: negativos } },
                select: {
                  cantidad: true,
                  producto: { select: { nombre: true, unidadVenta: true } },
                },
              })
            ).map((s) => ({
              nombre: s.producto.nombre,
              unidadVenta: s.producto.unidadVenta,
              stock: textoCantidad(s.cantidad),
            }));

      return { ok: true as const, stockNegativo };
    });
  } catch (error) {
    // Respaldo de la clave única de `AnulacionCompra.compraId`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorCompra("YA_ANULADA", "La compra ya estaba anulada.");
    }
    throw error;
  }
}
