import { signOut } from "@/lib/auth";

/**
 * Cierra la sesión cuando el JWT quedó desactualizado respecto de la base de
 * datos: usuario desactivado, o con rol o sucursal cambiados por un
 * administrador. El layout del dashboard redirige acá porque un server
 * component no puede borrar la cookie de sesión.
 *
 * No modifica nada más que la sesión de quien la llama, así que un GET es
 * aceptable: lo peor que puede hacer un enlace malicioso es desloguear.
 */
export async function GET() {
  await signOut({ redirectTo: "/login?motivo=sesion" });
}
