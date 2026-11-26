import type { MedioPagoProveedor } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { saldoDeProveedor } from "@/lib/compras/saldo";
import { formatoMoneda } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

import {
  esClaveDuplicada,
  OPCIONES_TRANSACCION,
  resolverSucursalCaja,
  validarClave,
  validarMonto,
  validarNota,
} from "./comun";
import { ErrorCuenta } from "./tipos";

export type DatosPagoProveedor = {
  claveIdempotencia: string;
  proveedorId: number;
  /** Monto con hasta 2 decimales, como string. */
  monto: string;
  medioPago: MedioPagoProveedor;
  /** Caja de la que sale el efectivo. Solo para `EFECTIVO_CAJA`. */
  sucursalId: number | null;
  nota: string | null;
};

export type PagoRegistrado = { pagoId: number; yaRegistrado: boolean };

async function pagoPorClave(clave: string): Promise<PagoRegistrado | null> {
  const pago = await prisma.movimientoProveedor.findUnique({
    where: { claveIdempotencia: clave },
    select: { id: true },
  });
  return pago ? { pagoId: pago.id, yaRegistrado: true } : null;
}

/**
 * Pago a un proveedor (sección 6.2 de Especificacion_Cierre_Cuentas.md). Solo
 * administrador. No puede superar el saldo por pagar.
 *
 * Solo el efectivo de caja sale del cajón de ventas y resta en el próximo
 * cierre de esa sucursal. Los otros medios no tocan ninguna caja.
 */
export async function registrarPagoProveedor(
  usuario: UsuarioActivo,
  datos: DatosPagoProveedor,
): Promise<PagoRegistrado> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCuenta("SIN_PERMISO", "Solo el administrador registra pagos a proveedores.");
  }
  validarClave(datos.claveIdempotencia);
  const monto = validarMonto(datos.monto);
  const nota = validarNota(datos.nota);

  const existente = await pagoPorClave(datos.claveIdempotencia);
  if (existente) return existente;

  const sucursalId =
    datos.medioPago === "EFECTIVO_CAJA"
      ? await resolverSucursalCaja(usuario, datos.sucursalId)
      : null;

  try {
    const pago = await prisma.$transaction(async (tx) => {
      // Bloquea al proveedor: dos pagos simultáneos no pueden pasar juntos el tope del saldo.
      const filas = await tx.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "Proveedor" WHERE "id" = ${datos.proveedorId}::int FOR UPDATE`;
      if (filas.length === 0) {
        throw new ErrorCuenta("PROVEEDOR_NO_ENCONTRADO", "El proveedor no existe.");
      }

      const saldo = await saldoDeProveedor(tx, datos.proveedorId);
      if (!saldo.gt(0)) {
        throw new ErrorCuenta("SIN_SALDO", "No hay saldo pendiente con este proveedor.");
      }
      if (monto.gt(saldo)) {
        throw new ErrorCuenta(
          "SUPERA_SALDO",
          `Se le deben ${formatoMoneda(saldo)}: el pago no puede ser mayor.`,
          "monto",
        );
      }

      return tx.movimientoProveedor.create({
        data: {
          proveedorId: datos.proveedorId,
          tipo: "PAGO",
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
    return { pagoId: pago.id, yaRegistrado: false };
  } catch (error) {
    if (esClaveDuplicada(error)) {
      const original = await pagoPorClave(datos.claveIdempotencia);
      if (original) return original;
    }
    throw error;
  }
}
