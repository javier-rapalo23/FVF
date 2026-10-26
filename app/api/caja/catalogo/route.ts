import { requerirUsuarioActivo } from "@/lib/acceso";
import { obtenerCatalogo } from "@/lib/ventas/catalogo";
import { errorSinSesion, responder, responderError } from "@/lib/ventas/http";
import { resolverSucursal } from "@/lib/ventas/sucursal";

export const dynamic = "force-dynamic";

/** Catálogo completo para la caja: productos, stock de la sucursal y clientes con saldo. */
export async function GET(request: Request) {
  try {
    const usuario = await requerirUsuarioActivo();
    if (!usuario) throw errorSinSesion();

    // `sucursalId` solo lo considera un administrador sin sucursal asignada.
    const parametro = new URL(request.url).searchParams.get("sucursalId");
    const solicitada = parametro && /^\d+$/.test(parametro) ? Number(parametro) : null;

    const sucursal = await resolverSucursal(
      usuario,
      usuario.rol === "ADMINISTRADOR" ? solicitada : null,
    );

    return responder(await obtenerCatalogo(sucursal));
  } catch (error) {
    return responderError(error);
  }
}
