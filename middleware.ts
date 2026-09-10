import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// El middleware usa la config sin el provider de credenciales: en Edge Runtime
// no se puede cargar Prisma. Alcanza con el JWT para resolver sesión y rol.
export default NextAuth(authConfig).auth;

export const config = {
  /**
   * Todo pasa por el middleware salvo /api, los assets de Next y los archivos
   * estáticos. Las rutas de /api que se agreguen mas adelante deben validar la
   * sesión con `auth()` dentro del route handler.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.png$).*)"],
};
