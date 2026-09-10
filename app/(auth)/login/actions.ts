"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";

export type EstadoLogin = { error: string | null };

export async function autenticar(
  _estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      // "/" resuelve el destino segun el rol (ver app/page.tsx).
      redirectTo: "/",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Email o contraseña incorrectos."
            : "No se pudo iniciar sesión. Intenta de nuevo.",
      };
    }
    // signIn lanza el redirect de Next como excepción: hay que dejarlo pasar.
    throw error;
  }
}
