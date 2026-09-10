import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar | Inversiones Ferrera",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">
            Inversiones Ferrera
          </h1>
          <p className="text-sm text-slate-500">
            Ingresa con tu usuario para continuar.
          </p>
        </header>

        <LoginForm />
      </div>
    </main>
  );
}
