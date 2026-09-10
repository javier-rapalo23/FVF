import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { modulosVisibles } from "@/lib/permissions";

import { NavLateral } from "./_components/nav-lateral";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El middleware ya bloqueó el acceso sin sesión; esto es la red de seguridad
  // del lado del servidor y además nos da los datos del usuario para la nav.
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");

  const { user } = sesion;

  async function cerrarSesion() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-sm font-semibold text-slate-900">
          Inversiones Ferrera
        </span>

        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-500">
              {user.rol === "ADMINISTRADOR" ? "Administrador" : "Empleado de caja"}
            </p>
          </div>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-3">
          <NavLateral modulos={modulosVisibles(user.rol)} />
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
