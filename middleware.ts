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
   *
   * Los formatos de imagen se excluyen por extensión: sin esto el favicon
   * (`app/icon.svg`) cae en el redirect a /login y no se muestra en la propia
   * pantalla de login, que es justo donde se ve sin sesión.
   *
   * El service worker y el manifest también: el navegador los vuelve a pedir
   * para actualizarlos aunque la sesión haya vencido.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)",
  ],
};
