import type { UsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import { OPCIONES_TRANSACCION } from "./comun";
import {
  ErrorCuenta,
  MAXIMO_MOTIVO_ANULACION_CUENTA,
  MINIMO_MOTIVO_ANULACION_CUENTA,
  type EfectoAnulacionCuenta,
} from "./tipos";

/*
 * Anulación de abonos de clientes y pagos a proveedores. Solo administrador,
 * con motivo. Mismo criterio que la anulación de gastos:
 *
 * - El movimiento queda visible, marcado como anulado, y deja de restar del
 *   saldo: el cliente vuelve a deber lo abonado; al proveedor se le vuelve a
 *   deber lo pagado.
 * - Efectivo de caja sin cierre: el cierre lo asigna igual pero no lo cuenta.
 * - Efectivo de caja ya cerrado: ese cierre no cambia (el cajón ya se contó) y
 *   el siguiente tampoco. Si el dinero en realidad no se movió, aquel cierre
 *   mostró una diferencia que se explica en su revisión.
 *
 * Se bloquea la fila del movimiento (`FOR UPDATE`), así la anulación no se
 * cruza con un cierre que lo esté asignando: si el cierre llegó primero, el
 * movimiento ya tiene `cierreCajaId`; si llegó la anulación, el cierre lo
 * asigna pero ya lo ve anulado.
 */

export function validarMotivoAnulacion(crudo: unknown): string {
  const motivo = typeof crudo === "string" ? crudo.trim().replace(/\s+/g, " ") : "";
  if (
    motivo.length < MINIMO_MOTIVO_ANULACION_CUENTA ||
    motivo.length > MAXIMO_MOTIVO_ANULACION_CUENTA
  ) {
    throw new ErrorCuenta(
      "MOTIVO_INVALIDO",
      `El motivo debe tener entre ${MINIMO_MOTIVO_ANULACION_CUENTA} y ${MAXIMO_MOTIVO_ANULACION_CUENTA} caracteres.`,
    );
  }
  return motivo;
}

/** Efecto en la caja de anular un movimiento vigente. */
export function efectoAnulacion(
  deCaja: boolean,
  cierreCajaId: number | null,
): EfectoAnulacionCuenta {
  if (!deCaja) return { tipo: "OTRO_MEDIO" };
  return cierreCajaId === null
    ? { tipo: "CAJA_PENDIENTE" }
    : { tipo: "CAJA_CERRADA", cierreId: cierreCajaId };
}

type FilaBloqueada = {
  tipo: string;
  medioPago: string | null;
  anulado: boolean;
  cierreCajaId: number | null;
};

function exigirAdministrador(usuario: UsuarioActivo, que: string) {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCuenta("SIN_PERMISO", `Solo el administrador puede anular ${que}.`);
  }
}

/** Anula un abono de cliente. Devuelve el efecto en la caja para mostrarlo. */
export async function anularAbono(
  usuario: UsuarioActivo,
  abonoId: number,
  motivoCrudo: unknown,
): Promise<EfectoAnulacionCuenta> {
  exigirAdministrador(usuario, "abonos");
  const motivo = validarMotivoAnulacion(motivoCrudo);

  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<FilaBloqueada[]>`
      SELECT "tipo"::text AS "tipo", "medioPago"::text AS "medioPago", "anulado", "cierreCajaId"
      FROM "MovimientoCuenta" WHERE "id" = ${abonoId}::int FOR UPDATE`;
    const abono = filas[0];
    if (!abono || abono.tipo !== "ABONO") {
      throw new ErrorCuenta("ABONO_NO_ENCONTRADO", "El abono no existe.");
    }
    if (abono.anulado) throw new ErrorCuenta("YA_ANULADO", "El abono ya estaba anulado.");

    await tx.movimientoCuenta.update({
      where: { id: abonoId },
      data: { anulado: true, anuladoEn: new Date(), anuladoPorId: usuario.id, motivoAnulacion: motivo },
    });
    return efectoAnulacion(abono.medioPago === "EFECTIVO", abono.cierreCajaId);
  }, OPCIONES_TRANSACCION);
}

/** Anula un pago a proveedor. Devuelve el efecto en la caja para mostrarlo. */
export async function anularPagoProveedor(
  usuario: UsuarioActivo,
  proveedorId: number,
  pagoId: number,
  motivoCrudo: unknown,
): Promise<EfectoAnulacionCuenta> {
  exigirAdministrador(usuario, "pagos a proveedores");
  const motivo = validarMotivoAnulacion(motivoCrudo);

  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<FilaBloqueada[]>`
      SELECT "tipo"::text AS "tipo", "medioPago"::text AS "medioPago", "anulado", "cierreCajaId"
      FROM "MovimientoProveedor"
      WHERE "id" = ${pagoId}::int AND "proveedorId" = ${proveedorId}::int FOR UPDATE`;
    const pago = filas[0];
    if (!pago || pago.tipo !== "PAGO") {
      throw new ErrorCuenta("PAGO_NO_ENCONTRADO", "El pago no existe.");
    }
    if (pago.anulado) throw new ErrorCuenta("YA_ANULADO", "El pago ya estaba anulado.");

    await tx.movimientoProveedor.update({
      where: { id: pagoId },
      data: { anulado: true, anuladoEn: new Date(), anuladoPorId: usuario.id, motivoAnulacion: motivo },
    });
    return efectoAnulacion(pago.medioPago === "EFECTIVO_CAJA", pago.cierreCajaId);
  }, OPCIONES_TRANSACCION);
}
