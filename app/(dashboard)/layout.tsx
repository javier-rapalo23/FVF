import { redirect } from "next/navigation";

import { Icono } from "@/components/ui/icono";
import { Marca } from "@/components/ui/marca";
import { auth, signOut } from "@/lib/auth";
import { modulosVisibles, navegacionPorGrupo } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { CerrarSesion } from "./_components/cerrar-sesion";
import { EstadoConexion } from "./_components/estado-conexion";
import { NavLateral } from "./_components/nav-lateral";
import { NavMovil } from "./_components/nav-movil";

const NOMBRE_ROL = {
  ADMINISTRADOR: "Administrador",
  EMPLEADO_CAJA: "Empleado de caja",
} as const;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // El middleware ya bloqueó el acceso sin sesión; esto es la red de seguridad
  // del lado del servidor y además nos da los datos del usuario para la nav.
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");

  const { user } = sesion;

  const [vigente, sucursal] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: Number(user.id) },
      select: { activo: true, rol: true, sucursalId: true },
    }),
    user.sucursalId
      ? prisma.sucursal.findUnique({
          where: { id: user.sucursalId },
          select: { nombre: true },
        })
      : null,
  ]);

  // El JWT guarda rol y sucursal del momento del login. Si un administrador
  // desactivó al usuario o le cambió el acceso, la sesión se cierra para que
  // vuelva a entrar con los permisos actuales.
  if (
    !vigente ||
    !vigente.activo ||
    vigente.rol !== user.rol ||
    vigente.sucursalId !== user.sucursalId
  ) {
    redirect("/api/sesion/cerrar");
  }

  const iniciales = (user.name ?? "")
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0] ?? "")
    .join("")
    .toUpperCase();

  async function cerrarSesion() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-imprimir sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-borde bg-superficie px-4">
        <div className="flex items-center gap-4">
          <Marca />

          {sucursal ? (
            <>
              <span aria-hidden className="h-5 w-px bg-borde" />
              <span className="flex items-center gap-1.5 text-[13px] text-tinta-media">
                <span className="text-tinta-suave">
                  <Icono nombre="tienda" tamano={15} />
                </span>
                {sucursal.nombre}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <EstadoConexion usuario={{ id: Number(user.id), rol: user.rol }} />

          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13px] font-medium text-tinta">{user.name}</p>
            <p className="text-[11px] text-tinta-suave">{NOMBRE_ROL[user.rol]}</p>
          </div>

          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-borde bg-superficie-suave font-mono text-[11px] font-medium text-tinta-media">
            {iniciales || "—"}
          </span>

          <CerrarSesion accion={cerrarSesion} usuarioId={Number(user.id)} />
        </div>
      </header>

      <NavMovil modulos={modulosVisibles(user.rol)} />

      <div className="flex flex-1">
        <aside className="no-imprimir sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[248px] shrink-0 overflow-y-auto border-r border-borde px-3 py-5 md:block">
          <NavLateral secciones={navegacionPorGrupo(user.rol)} />
        </aside>

        <main className="min-w-0 flex-1 px-6 py-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
