import type { Rol } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol;
      sucursalId: number | null;
    } & DefaultSession["user"];
  }

  /** Lo que devuelve `authorize()` en el provider de credenciales. */
  interface User {
    rol: Rol;
    sucursalId: number | null;
  }
}

// `next-auth/jwt` solo reexporta `@auth/core/jwt`, así que la augmentacion del
// token tiene que declararse sobre el módulo original.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    sucursalId: number | null;
  }
}
