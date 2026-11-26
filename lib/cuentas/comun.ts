import { Prisma } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { aDecimal } from "@/lib/calculos";
import { prisma } from "@/lib/prisma";

import { ErrorCuenta, MAXIMO_NOTA_CUENTA } from "./tipos";

/*
 * Validaciones compartidas por abonos de clientes y pagos a proveedores.
 */

export const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tope de `Decimal(10,2)`. */
const MONTO_MAXIMO = new Prisma.Decimal("99999999.99");

export const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 15_000 };

export function validarClave(clave: string): void {
  if (!PATRON_UUID.test(clave)) {
    throw new ErrorCuenta("SIN_PERMISO", "El formulario no es válido. Recargá la página.");
  }
}

export function validarMonto(texto: string): Prisma.Decimal {
  let monto: Prisma.Decimal;
  try {
    monto = aDecimal(texto);
  } catch {
    throw new ErrorCuenta("MONTO_INVALIDO", "Escribí un monto válido.", "monto");
  }
  if (!monto.gt(0) || monto.gt(MONTO_MAXIMO) || monto.decimalPlaces() > 2) {
    throw new ErrorCuenta("MONTO_INVALIDO", "Escribí un monto mayor que cero.", "monto");
  }
  return monto;
}

export function validarNota(nota: string | null): string | null {
  const limpia = nota?.trim() || null;
  if (limpia && limpia.length > MAXIMO_NOTA_CUENTA) {
    throw new ErrorCuenta("NOTA_INVALIDA", `Máximo ${MAXIMO_NOTA_CUENTA} caracteres.`, "nota");
  }
  return limpia;
}

/**
 * Caja que recibe o entrega el efectivo. Mismo criterio que gastos y caja:
 * la sucursal del usuario si tiene una; si no (un administrador), la elegida,
 * o la única que haya.
 */
export async function resolverSucursalCaja(
  usuario: UsuarioActivo,
  solicitada: number | null,
): Promise<number> {
  if (usuario.sucursalId !== null) {
    if (solicitada !== null && solicitada !== usuario.sucursalId) {
      throw new ErrorCuenta(
        "SIN_PERMISO",
        "Solo podés mover efectivo de la caja de tu sucursal.",
        "sucursalId",
      );
    }
    return usuario.sucursalId;
  }
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCuenta(
      "SUCURSAL_REQUERIDA",
      "Tu usuario no tiene una sucursal asignada. Pedile al administrador que te asigne una.",
    );
  }

  const sucursales = await prisma.sucursal.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  if (solicitada !== null) {
    if (!sucursales.some((s) => s.id === solicitada)) {
      throw new ErrorCuenta("SUCURSAL_REQUERIDA", "La sucursal elegida ya no existe.", "sucursalId");
    }
    return solicitada;
  }
  if (sucursales.length === 1) return sucursales[0]!.id;
  throw new ErrorCuenta(
    "SUCURSAL_REQUERIDA",
    sucursales.length === 0 ? "No hay ninguna sucursal cargada." : "Elegí la caja de la sucursal.",
    "sucursalId",
  );
}

export function esClaveDuplicada(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("claveIdempotencia")
  );
}
