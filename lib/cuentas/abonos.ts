import type { MedioAbono } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { formatoMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import { saldoDeCliente } from "@/lib/ventas/saldo";

import {
  esClaveDuplicada,
  OPCIONES_TRANSACCION,
  resolverSucursalCaja,
  validarClave,
  validarMonto,
  validarNota,
} from "./comun";
import { ErrorCuenta } from "./tipos";

export type DatosAbono = {
  claveIdempotencia: string;
  clienteId: number;
  /** Monto con hasta 2 decimales, como string. */
  monto: string;
  medioPago: MedioAbono;
  /** Solo la manda un administrador sin sucursal fija, para el efectivo. */
  sucursalId: number | null;
  nota: string | null;
};

export type AbonoRegistrado = { abonoId: number; yaRegistrado: boolean };

async function abonoPorClave(clave: string): Promise<AbonoRegistrado | null> {
  const abono = await prisma.movimientoCuenta.findUnique({
    where: { claveIdempotencia: clave },
    select: { id: true },
  });
  return abono ? { abonoId: abono.id, yaRegistrado: true } : null;
}

/**
 * Abono de un cliente a su cuenta de fiado (sección 6.1 de
 * Especificacion_Cierre_Cuentas.md). Lo registran el administrador y el
 * empleado de caja. No puede superar lo que el cliente debe.
 *
 * El efectivo entra al cajón de la sucursal y suma en su próximo cierre. Los
 * otros medios guardan la sucursal del usuario, si tiene una, como dato.
 */
export async function registrarAbono(
  usuario: UsuarioActivo,
  datos: DatosAbono,
): Promise<AbonoRegistrado> {
  validarClave(datos.claveIdempotencia);
  const monto = validarMonto(datos.monto);
  const nota = validarNota(datos.nota);

  const existente = await abonoPorClave(datos.claveIdempotencia);
  if (existente) return existente;

  const esAdmin = usuario.rol === "ADMINISTRADOR";
  if (!esAdmin && usuario.sucursalId === null) {
    throw new ErrorCuenta(
      "SUCURSAL_REQUERIDA",
      "Tu usuario no tiene una sucursal asignada. Pedile al administrador que te asigne una.",
    );
  }
  const sucursalId =
    datos.medioPago === "EFECTIVO"
      ? await resolverSucursalCaja(usuario, datos.sucursalId)
      : usuario.sucursalId;

  try {
    const abono = await prisma.$transaction(async (tx) => {
      // Bloquea al cliente: dos abonos simultáneos no pueden pasar juntos el tope del saldo.
      const filas = await tx.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "Cliente" WHERE "id" = ${datos.clienteId}::int FOR UPDATE`;
      if (filas.length === 0) {
        throw new ErrorCuenta("CLIENTE_NO_ENCONTRADO", "El cliente no existe.", "clienteId");
      }

      const saldo = await saldoDeCliente(tx, datos.clienteId);
      if (!saldo.gt(0)) {
        throw new ErrorCuenta("SIN_SALDO", "El cliente no tiene deuda pendiente.", "clienteId");
      }
      if (monto.gt(saldo)) {
        throw new ErrorCuenta(
          "SUPERA_SALDO",
          `El cliente debe ${formatoMoneda(saldo)}: el abono no puede ser mayor.`,
          "monto",
        );
      }

      return tx.movimientoCuenta.create({
        data: {
          clienteId: datos.clienteId,
          tipo: "ABONO",
          monto,
          medioPago: datos.medioPago,
          usuarioId: usuario.id,
          sucursalId,
          nota,
          claveIdempotencia: datos.claveIdempotencia,
        },
        select: { id: true },
      });
    }, OPCIONES_TRANSACCION);
    return { abonoId: abono.id, yaRegistrado: false };
  } catch (error) {
    if (esClaveDuplicada(error)) {
      const original = await abonoPorClave(datos.claveIdempotencia);
      if (original) return original;
    }
    throw error;
  }
}
