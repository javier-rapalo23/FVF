import { Prisma } from "@prisma/client";

import type { UsuarioActivo } from "@/lib/acceso";
import { aDecimal, textoMonto, validarMontoNoNegativo } from "@/lib/calculos";
import { DENOMINACIONES, DIFERENCIA_CIERRE_NOTA } from "@/lib/config";
import { prisma } from "@/lib/prisma";

import {
  estadoCaja,
  filtroAbonosPendientes,
  filtroGastosPendientes,
  filtroPagosProveedorPendientes,
  totalesDeCierre,
  totalesPendientes,
} from "./calcular";
import {
  ErrorCierre,
  type DetalleConteo,
  type PayloadCierre,
  type PayloadVistaPrevia,
  type ResultadoCierre,
  type ResultadoVistaPrevia,
  type TotalesCierre,
} from "./tipos";

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMO_NOTAS = 500;
const MAXIMO_PIEZAS = 100_000;
/** Tope de `Decimal(10,2)`. */
const MONTO_MAXIMO = new Prisma.Decimal("99999999.99");

/** Asigna ventas y anulaciones fila por fila: margen para un día cargado. */
const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 20_000 };

type CierreOk = Extract<ResultadoCierre, { ok: true }>;

// ------------------------------------------------------------ Validación

function invalido(mensaje: string): never {
  throw new ErrorCierre("PAYLOAD_INVALIDO", mensaje);
}

function esIdPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0 && valor <= 2_147_483_647;
}

function objeto(crudo: unknown): Record<string, unknown> {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
    invalido("Los datos del cierre no son válidos.");
  }
  return crudo as Record<string, unknown>;
}

function idOpcional(valor: unknown, campo: string): number | null {
  if (valor === null || valor === undefined) return null;
  if (!esIdPositivo(valor)) invalido(`"${campo}" debe ser un id numérico o null.`);
  return valor;
}

function monto(valor: unknown, etiqueta: string, codigo: "MONTO_INVALIDO" | "FONDO_INVALIDO"): Prisma.Decimal {
  if (typeof valor !== "string") invalido(`"${etiqueta}" debe viajar como string.`);
  const r = validarMontoNoNegativo(valor);
  if (!r.valido) throw new ErrorCierre(codigo, `${etiqueta}: ${r.mensaje}`);
  return r.monto;
}

function validarVistaPrevia(p: Record<string, unknown>): PayloadVistaPrevia {
  return {
    sucursalId: idOpcional(p.sucursalId, "sucursalId"),
    cierreAnteriorId: idOpcional(p.cierreAnteriorId, "cierreAnteriorId"),
    fondoInicial:
      p.fondoInicial === null || p.fondoInicial === undefined || p.fondoInicial === ""
        ? null
        : monto(p.fondoInicial, "Fondo inicial", "FONDO_INVALIDO").toString(),
  };
}

/** Billetes y monedas: solo denominaciones conocidas y cantidades enteras. */
function validarDetalle(crudo: unknown): { detalle: DetalleConteo; total: Prisma.Decimal } | null {
  if (crudo === null || crudo === undefined) return null;
  const d = objeto(crudo);
  const detalle: DetalleConteo = {};
  let total = new Prisma.Decimal(0);

  for (const [clave, valor] of Object.entries(d)) {
    const denominacion = DENOMINACIONES.find((x) => x === clave);
    if (!denominacion) invalido(`Denominación desconocida: ${clave}.`);
    if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > MAXIMO_PIEZAS) {
      throw new ErrorCierre("MONTO_INVALIDO", `Cantidad inválida de L ${clave}.`);
    }
    if (valor === 0) continue;
    detalle[denominacion] = valor;
    total = total.plus(aDecimal(denominacion).mul(valor));
  }
  return { detalle, total };
}

function textoOpcional(valor: unknown, maximo: number): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "string") invalido("Las notas deben ser texto.");
  const limpio = valor.trim().replace(/[^\S\n]+/g, " ");
  if (limpio.length > maximo) invalido(`Las notas admiten hasta ${maximo} caracteres.`);
  return limpio || null;
}

// ------------------------------------------------------------ Sucursal

/**
 * Sucursal del cierre: la del usuario si tiene una (siempre el caso del
 * empleado); si no, la elegida en pantalla, o la única que haya.
 */
export async function resolverSucursalCierre(
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
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCierre(
      "SUCURSAL_REQUERIDA",
      "Tu usuario no tiene una sucursal asignada. Pedile al administrador que te asigne una.",
    );
  }

  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: "asc" },
  });
  const elegida = sucursales.find((s) => s.id === solicitada);
  if (elegida) return elegida;
  if (sucursales.length === 1 && solicitada === null) return sucursales[0]!;
  throw new ErrorCierre(
    "SUCURSAL_REQUERIDA",
    sucursales.length === 0 ? "No hay ninguna sucursal cargada." : "Elegí la sucursal que estás cerrando.",
  );
}

// ------------------------------------------------------------ Apoyo

const DESACTUALIZADO = () =>
  new ErrorCierre(
    "CIERRE_DESACTUALIZADO",
    "Otro usuario cerró esta caja mientras contabas. Recargá la página para empezar el cierre nuevo.",
  );

function fondoDelPeriodo(
  anterior: { fondoSiguiente: Prisma.Decimal } | null,
  fondoInicial: string | null,
): Prisma.Decimal {
  if (anterior) return anterior.fondoSiguiente;
  if (fondoInicial === null) {
    throw new ErrorCierre("FONDO_INVALIDO", "Es el primer cierre de la caja: escribí con cuánto arrancó.");
  }
  return aDecimal(fondoInicial);
}

function resultado(
  cierre: {
    id: number;
    fondoInicial: Prisma.Decimal;
    ventasEfectivo: Prisma.Decimal;
    devolucionesEfectivo: Prisma.Decimal;
    ventasTransferencia: Prisma.Decimal;
    ventasTarjeta: Prisma.Decimal;
    ventasFiado: Prisma.Decimal;
    cantidadVentas: number;
    gastosCaja: Prisma.Decimal;
    abonosEfectivo: Prisma.Decimal;
    pagosProveedorCaja: Prisma.Decimal;
    totalSistema: Prisma.Decimal;
    totalContado: Prisma.Decimal;
    diferencia: Prisma.Decimal;
    fondoSiguiente: Prisma.Decimal;
  },
  yaRegistrado: boolean,
): CierreOk {
  return {
    ok: true,
    cierreId: cierre.id,
    yaRegistrado,
    totales: {
      fondoInicial: textoMonto(cierre.fondoInicial),
      ventasEfectivo: textoMonto(cierre.ventasEfectivo),
      devolucionesEfectivo: textoMonto(cierre.devolucionesEfectivo),
      ventasTransferencia: textoMonto(cierre.ventasTransferencia),
      ventasTarjeta: textoMonto(cierre.ventasTarjeta),
      ventasFiado: textoMonto(cierre.ventasFiado),
      cantidadVentas: cierre.cantidadVentas,
      gastosCaja: textoMonto(cierre.gastosCaja),
      abonosEfectivo: textoMonto(cierre.abonosEfectivo),
      pagosProveedorCaja: textoMonto(cierre.pagosProveedorCaja),
      esperado: textoMonto(cierre.totalSistema),
    },
    totalContado: textoMonto(cierre.totalContado),
    diferencia: textoMonto(cierre.diferencia),
    fondoSiguiente: textoMonto(cierre.fondoSiguiente),
    retiro: textoMonto(cierre.totalContado.minus(cierre.fondoSiguiente)),
  };
}

const SELECCION_RESULTADO = {
  id: true,
  fondoInicial: true,
  ventasEfectivo: true,
  devolucionesEfectivo: true,
  ventasTransferencia: true,
  ventasTarjeta: true,
  ventasFiado: true,
  cantidadVentas: true,
  gastosCaja: true,
  abonosEfectivo: true,
  pagosProveedorCaja: true,
  totalSistema: true,
  totalContado: true,
  diferencia: true,
  fondoSiguiente: true,
} as const;

async function cierrePorClave(clave: string): Promise<CierreOk | null> {
  const cierre = await prisma.cierreCaja.findUnique({
    where: { claveIdempotencia: clave },
    select: SELECCION_RESULTADO,
  });
  return cierre ? resultado(cierre, true) : null;
}

/** Diferencia que exige nota. */
export function exigeNota(diferencia: Prisma.Decimal): boolean {
  return diferencia.abs().gt(DIFERENCIA_CIERRE_NOTA);
}

// ------------------------------------------------------------ Operaciones

/**
 * Lo que daría el cierre si se hiciera ahora, sin escribir nada. Es el paso
 * de confirmación: después de contar, el empleado ve el esperado.
 */
export async function vistaPreviaCierre(
  usuario: UsuarioActivo,
  crudo: unknown,
): Promise<Extract<ResultadoVistaPrevia, { ok: true }>> {
  const payload = validarVistaPrevia(objeto(crudo));
  const sucursal = await resolverSucursalCierre(usuario, payload.sucursalId);
  const estado = await estadoCaja(prisma, sucursal.id);
  if ((estado.cierreAnterior?.id ?? null) !== payload.cierreAnteriorId) throw DESACTUALIZADO();

  const fondo = fondoDelPeriodo(estado.cierreAnterior, payload.fondoInicial);
  const totales = await totalesPendientes(prisma, sucursal.id, estado.inicioCadena, fondo);
  return { ok: true, totales };
}

/**
 * Registra el cierre. En una transacción:
 * 1. bloquea la fila de la sucursal: los cierres de una sucursal se hacen de a
 *    uno, y se comprueba que el anterior sea el que vio la pantalla;
 * 2. crea el cierre y le asigna las ventas, anulaciones, gastos de caja,
 *    abonos en efectivo y pagos a proveedores de caja sin cierre;
 * 3. calcula los importes sobre lo asignado (no sobre un rango de horas: lo
 *    que se registre en paralelo queda para el cierre siguiente) y los guarda.
 */
export async function registrarCierre(usuario: UsuarioActivo, crudo: unknown): Promise<CierreOk> {
  const p = objeto(crudo);
  if (typeof p.claveIdempotencia !== "string" || !PATRON_UUID.test(p.claveIdempotencia)) {
    invalido('"claveIdempotencia" debe ser un UUID.');
  }
  const base = validarVistaPrevia(p);
  const detalle = validarDetalle(p.detalleConteo);
  const contado = detalle ? detalle.total : monto(p.totalContado, "Total contado", "MONTO_INVALIDO");
  if (contado.gt(MONTO_MAXIMO)) throw new ErrorCierre("MONTO_INVALIDO", "El total contado es demasiado alto.");
  const fondoSiguiente = monto(p.fondoSiguiente, "Fondo para el turno siguiente", "FONDO_INVALIDO");
  if (fondoSiguiente.gt(contado)) {
    throw new ErrorCierre("FONDO_INVALIDO", "El fondo que queda no puede ser mayor que lo contado.");
  }
  const payload: PayloadCierre = {
    ...base,
    claveIdempotencia: p.claveIdempotencia,
    totalContado: contado.toString(),
    detalleConteo: detalle?.detalle ?? null,
    fondoSiguiente: fondoSiguiente.toString(),
    notas: textoOpcional(p.notas, MAXIMO_NOTAS),
  };

  const existente = await cierrePorClave(payload.claveIdempotencia);
  if (existente) return existente;

  const sucursal = await resolverSucursalCierre(usuario, payload.sucursalId);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Sucursal" WHERE "id" = ${sucursal.id}::int FOR UPDATE`;

      const estado = await estadoCaja(tx, sucursal.id);
      const anteriorId = estado.cierreAnterior?.id ?? null;
      if (anteriorId !== payload.cierreAnteriorId) throw DESACTUALIZADO();
      const fondoInicial = fondoDelPeriodo(estado.cierreAnterior, payload.fondoInicial);

      const cero = new Prisma.Decimal(0);
      const cierre = await tx.cierreCaja.create({
        data: {
          claveIdempotencia: payload.claveIdempotencia,
          fecha: new Date(),
          desde: estado.desde,
          usuarioId: usuario.id,
          sucursalId: sucursal.id,
          cierreAnteriorId: anteriorId,
          fondoInicial,
          // Provisorios: se completan después de asignar ventas.
          ventasEfectivo: cero,
          devolucionesEfectivo: cero,
          ventasTransferencia: cero,
          ventasTarjeta: cero,
          ventasFiado: cero,
          cantidadVentas: 0,
          totalSistema: cero,
          totalContado: contado,
          diferencia: cero,
          fondoSiguiente,
          detalleConteo: payload.detalleConteo ?? Prisma.DbNull,
          notas: payload.notas,
        },
        select: { id: true },
      });

      await tx.venta.updateMany({
        where: { sucursalId: sucursal.id, cierreCajaId: null, creadoEn: { gte: estado.inicioCadena } },
        data: { cierreCajaId: cierre.id },
      });
      // Después de las ventas: así una anulación de una venta que entra ahora
      // también entra ahora (y no se toma como devolución en el siguiente).
      await tx.anulacionVenta.updateMany({
        where: {
          cierreCajaId: null,
          venta: { sucursalId: sucursal.id, cierreCajaId: { not: null } },
        },
        data: { cierreCajaId: cierre.id },
      });
      // Gastos pagados con el efectivo del cajón. Entran también los anulados
      // (no restan), igual que una venta anulada dentro del período.
      await tx.gasto.updateMany({
        where: filtroGastosPendientes(sucursal.id, estado.inicioCadena),
        data: { cierreCajaId: cierre.id },
      });
      // Abonos cobrados y pagos a proveedores con el efectivo del cajón. Igual
      // que los gastos, entran también los anulados, que no cuentan.
      await tx.movimientoCuenta.updateMany({
        where: filtroAbonosPendientes(sucursal.id, estado.inicioCadena),
        data: { cierreCajaId: cierre.id },
      });
      await tx.movimientoProveedor.updateMany({
        where: filtroPagosProveedorPendientes(sucursal.id, estado.inicioCadena),
        data: { cierreCajaId: cierre.id },
      });

      const totales: TotalesCierre = await totalesDeCierre(tx, cierre.id, fondoInicial);
      const esperado = aDecimal(totales.esperado);
      const diferencia = contado.minus(esperado);
      if (exigeNota(diferencia) && !payload.notas) {
        throw new ErrorCierre(
          "NOTA_REQUERIDA",
          `La diferencia es de ${textoMonto(diferencia)}: explicala en la nota antes de cerrar.`,
        );
      }

      const guardado = await tx.cierreCaja.update({
        where: { id: cierre.id },
        data: {
          ventasEfectivo: totales.ventasEfectivo,
          devolucionesEfectivo: totales.devolucionesEfectivo,
          ventasTransferencia: totales.ventasTransferencia,
          ventasTarjeta: totales.ventasTarjeta,
          ventasFiado: totales.ventasFiado,
          cantidadVentas: totales.cantidadVentas,
          gastosCaja: totales.gastosCaja,
          abonosEfectivo: totales.abonosEfectivo,
          pagosProveedorCaja: totales.pagosProveedorCaja,
          totalSistema: esperado,
          diferencia,
        },
        select: SELECCION_RESULTADO,
      });
      return resultado(guardado, false);
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const objetivo = JSON.stringify(error.meta?.target ?? "");
      if (objetivo.includes("claveIdempotencia")) {
        const original = await cierrePorClave(payload.claveIdempotencia);
        if (original) return original;
      }
      if (objetivo.includes("cierreAnteriorId")) throw DESACTUALIZADO();
    }
    throw error;
  }
}

/** Revisión del administrador. No cambia importes; queda quién y cuándo. */
export async function revisarCierre(
  usuario: UsuarioActivo,
  cierreId: number,
  notaCruda: unknown,
): Promise<void> {
  if (usuario.rol !== "ADMINISTRADOR") {
    throw new ErrorCierre("SIN_PERMISO", "Solo el administrador revisa cierres.");
  }
  const nota = textoOpcional(notaCruda, MAXIMO_NOTAS);

  const marcados = await prisma.cierreCaja.updateMany({
    where: { id: cierreId, revisadoPorId: null },
    data: { revisadoPorId: usuario.id, revisadoEn: new Date(), notaRevision: nota },
  });
  if (marcados.count === 0) {
    const existe = await prisma.cierreCaja.count({ where: { id: cierreId } });
    throw existe
      ? new ErrorCierre("YA_REVISADO", "El cierre ya estaba revisado.")
      : new ErrorCierre("CIERRE_NO_ENCONTRADO", "El cierre no existe.");
  }
}
