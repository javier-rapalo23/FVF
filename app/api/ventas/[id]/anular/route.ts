import { requerirUsuarioActivo } from "@/lib/acceso";
import { anularVenta, validarPayloadAnulacion } from "@/lib/ventas/anular";
import { errorSinSesion, leerJson, responder, responderError } from "@/lib/ventas/http";
import { ErrorVenta } from "@/lib/ventas/tipos";

/** Anula una venta completa. Solo administrador. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await requerirUsuarioActivo();
    if (!usuario) throw errorSinSesion();

    if (usuario.rol !== "ADMINISTRADOR") {
      throw new ErrorVenta("SIN_PERMISO", 403, "Solo el administrador puede anular ventas.");
    }

    const { id } = await params;
    const ventaId = /^\d+$/.test(id) ? Number(id) : NaN;
    // Fuera del rango de un INT de Postgres, Prisma fallaría con un 500.
    if (!Number.isSafeInteger(ventaId) || ventaId <= 0 || ventaId > 2_147_483_647) {
      throw new ErrorVenta("VENTA_NO_ENCONTRADA", 404, "La venta no existe.");
    }

    const datos = validarPayloadAnulacion(await leerJson(request));
    return responder(await anularVenta(usuario, ventaId, datos));
  } catch (error) {
    return responderError(error);
  }
}
