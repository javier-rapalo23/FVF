import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const usuario = await prisma.usuario.findUnique({
          where: { email: email.toLowerCase().trim() },
        });

        if (!usuario || !usuario.activo) return null;

        const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValida) return null;

        return {
          id: String(usuario.id),
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          sucursalId: usuario.sucursalId,
        };
      },
    }),
  ],
});
