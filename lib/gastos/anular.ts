import { Prisma } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import {
  ErrorGasto,
  MAXIMO_MOTIVO_ANULACION,
  MINIMO_MOTIVO_ANULACION,
  type EfectoAnulacion,
} from "./tipos";

export function validarMotivoAnulacion(crudo: unknown): string {
  const motivo = typeof crudo === "string" ? crudo.trim().replace(/\s+/g, " ") : "";
  if (motivo.length < MINIMO_MOTIVO_ANULACION || motivo.length > MAXIMO_MOTIVO_ANULACION) {
    throw new ErrorGasto(
      "MOTIVO_INVALIDO",
      `El motivo debe tener entre ${MINIMO_MOTIVO_ANULACION} y ${MAXIMO_MOTIVO_ANULACION} caracteres.`,
    );
  }
  return motivo;
}

/**
 * Anula un gasto (solo administrador). En una transacción bloquea la fila del
 * gasto, así no se cruza con un cierre que lo esté asignando: si el cierre
 * llegó primero, el gasto ya tiene `cierreCajaId` y ese cierre no cambia; si la
 * anulación llegó primero, el cierre lo asigna pero no lo resta.
 *
 * Un gasto de caja anulado después de su cierre no genera ningún movimiento en
 * el cierre siguiente: el cierre ya se contó con lo que había en el cajón.
 */
export async function anularGasto(
  usuario: UsuarioActivo,
  gastoId: number,
  motivoCrudo: unknown,
): Promise<EfectoAnulacion> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorGasto("SIN_PERMISO", "Solo el administrador puede anular gastos.");
  }
  const motivo = validarMotivoAnulacion(motivoCrudo);

  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<
        { anulado: boolean; medioPago: string; cierreCajaId: number | null }[]
      >`SELECT "anulado", "medioPago"::text AS "medioPago", "cierreCajaId" FROM "Gasto" WHERE "id" = ${gastoId}::int FOR UPDATE`;
      const gasto = filas[0];
      if (!gasto) throw new ErrorGasto("GASTO_NO_ENCONTRADO", "El gasto no existe.");
      if (gasto.anulado) throw new ErrorGasto("YA_ANULADO", "El gasto ya estaba anulado.");

      await tx.gasto.update({ where: { id: gastoId }, data: { anulado: true } });
      await tx.anulacionGasto.create({ data: { gastoId, usuarioId: usuario.id, motivo } });

      if (gasto.medioPago !== "EFECTIVO_CAJA") return { tipo: "OTRO_MEDIO" as const };
      return gasto.cierreCajaId === null
        ? { tipo: "CAJA_PENDIENTE" as const }
        : { tipo: "CAJA_CERRADA" as const, cierreId: gasto.cierreCajaId };
    });
  } catch (error) {
    // Respaldo de la clave única de `AnulacionGasto.gastoId`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorGasto("YA_ANULADO", "El gasto ya estaba anulado.");
    }
    throw error;
  }
}
