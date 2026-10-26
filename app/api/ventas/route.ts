import { requerirUsuarioActivo } from "@/lib/acceso";
import { errorSinSesion, leerJson, responder, responderError } from "@/lib/ventas/http";
import { registrarVenta, validarPayloadVenta } from "@/lib/ventas/registrar";

/** Registra una venta. Idempotente por `claveIdempotencia`. */
export async function POST(request: Request) {
  try {
    const usuario = await requerirUsuarioActivo();
    if (!usuario) throw errorSinSesion();

    const payload = validarPayloadVenta(await leerJson(request));
    const { http, cuerpo } = await registrarVenta(usuario, payload);

    return responder(cuerpo, http);
  } catch (error) {
    return responderError(error);
  }
}
