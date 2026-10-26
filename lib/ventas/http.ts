import { NextResponse } from "next/server";

import { ErrorVenta, type RespuestaError } from "./tipos";

/**
 * Respuestas de los Route Handlers de caja. Nada de esto se cachea: stock,
 * saldos y ventas cambian con cada cobro.
 */
const SIN_CACHE = { "Cache-Control": "no-store" };

export function responder(cuerpo: unknown, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

export function responderError(error: unknown) {
  if (error instanceof ErrorVenta) {
    const cuerpo: RespuestaError = {
      ...error.datos,
      error: error.codigo,
      mensaje: error.message,
    };
    return responder(cuerpo, error.http);
  }

  console.error("[caja] error inesperado", error);
  const cuerpo: RespuestaError = {
    error: "ERROR_INTERNO",
    mensaje: "Ocurrió un error inesperado. Reintentá en unos segundos.",
  };
  return responder(cuerpo, 500);
}

export function errorSinSesion() {
  return new ErrorVenta(
    "SIN_SESION",
    401,
    "Tu sesión venció o tu usuario fue desactivado. Volvé a iniciar sesión.",
  );
}

/** Cuerpo JSON de la petición; si no se puede leer, `PAYLOAD_INVALIDO`. */
export async function leerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ErrorVenta("PAYLOAD_INVALIDO", 400, "El cuerpo de la petición no es JSON válido.");
  }
}
