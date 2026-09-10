import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

import { esRutaPublica, puedeAccederRuta, rutaPorDefecto } from "@/lib/permissions";

/**
 * Configuracion de Auth.js compartida entre el middleware (Edge Runtime) y el
 * runtime de Node.
 *
 * El provider de credenciales NO vive acá porque necesita Prisma y bcrypt, que
 * no corren en Edge. Se agrega en `lib/auth.ts`, que es el archivo que usan las
 * rutas y los server components.
 */
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    /**
     * Chequeo centralizado de sesión y rol. Lo invoca el middleware para toda
     * ruta que matchee (ver `middleware.ts`), así ninguna página repite la
     * validación.
     */
    authorized({ auth, request: { nextUrl } }) {
      const usuario = auth?.user;
      const { pathname } = nextUrl;

      if (esRutaPublica(pathname)) {
        // Alguien con sesión activa no debería quedarse en el login.
        if (usuario) {
          return NextResponse.redirect(
            new URL(rutaPorDefecto(usuario.rol), nextUrl),
          );
        }
        return true;
      }

      // Sin sesión: Auth.js redirige al login con el callbackUrl correspondiente.
      if (!usuario) return false;

      if (!puedeAccederRuta(usuario.rol, pathname)) {
        return NextResponse.redirect(
          new URL(rutaPorDefecto(usuario.rol), nextUrl),
        );
      }

      return true;
    },

    // El rol y la sucursal viajan en el JWT para que el middleware pueda
    // resolver permisos sin tocar la base de datos.
    jwt({ token, user }) {
      if (user) {
        // `user.id` es opcional en el tipo base de Auth.js; nuestro provider siempre lo devuelve.
        token.id = user.id ?? token.sub ?? "";
        token.rol = user.rol;
        token.sucursalId = user.sucursalId;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.sucursalId = token.sucursalId;
      return session;
    },
  },
} satisfies NextAuthConfig;
