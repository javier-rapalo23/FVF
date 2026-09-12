import type { Rol } from "@prisma/client";

import type { NombreIcono } from "@/components/ui/icono";

/**
 * Fuente única de verdad de los permisos por ruta.
 *
 * La consumen el middleware (chequeo centralizado antes de renderizar) y el
 * layout del dashboard (para armar la navegación segun el rol). Ninguna página
 * repite la validación por su cuenta.
 *
 * Importante: este módulo corre también en el Edge Runtime del middleware, así
 * que no puede importar Prisma ni nada de Node.
 */
export type Modulo = {
  href: string;
  label: string;
  roles: readonly Rol[];
  /** Agrupación en la navegación lateral. */
  grupo: GrupoModulo;
  /**
   * Icono del módulo. Es solo un `import type`, así que no arrastra React ni
   * nada del bundle de componentes al Edge Runtime del middleware.
   */
  icono: NombreIcono;
};

/** Orden en que se muestran los grupos en la navegación. */
export const GRUPOS = ["Operación", "Gestión", "Administración"] as const;
export type GrupoModulo = (typeof GRUPOS)[number];

const TODOS = ["ADMINISTRADOR", "EMPLEADO_CAJA"] as const satisfies readonly Rol[];
const SOLO_ADMIN = ["ADMINISTRADOR"] as const satisfies readonly Rol[];

export const MODULOS: readonly Modulo[] = [
  { href: "/caja", label: "Caja / Ventas", roles: TODOS, grupo: "Operación", icono: "caja" },
  { href: "/cierres", label: "Cierres de caja", roles: TODOS, grupo: "Operación", icono: "cierres" },
  { href: "/productos", label: "Productos", roles: SOLO_ADMIN, grupo: "Gestión", icono: "productos" },
  { href: "/clientes", label: "Clientes", roles: SOLO_ADMIN, grupo: "Gestión", icono: "clientes" },
  { href: "/proveedores", label: "Proveedores", roles: SOLO_ADMIN, grupo: "Gestión", icono: "proveedores" },
  { href: "/compras", label: "Compras", roles: SOLO_ADMIN, grupo: "Gestión", icono: "compras" },
  { href: "/gastos", label: "Gastos", roles: SOLO_ADMIN, grupo: "Gestión", icono: "gastos" },
  { href: "/reportes", label: "Reportes", roles: SOLO_ADMIN, grupo: "Administración", icono: "reportes" },
  { href: "/usuarios", label: "Usuarios", roles: SOLO_ADMIN, grupo: "Administración", icono: "usuarios" },
];

/** Módulos visibles para un rol, ya agrupados y en el orden de `GRUPOS`. */
export function navegacionPorGrupo(
  rol: Rol,
): readonly { grupo: GrupoModulo; modulos: readonly Modulo[] }[] {
  const visibles = modulosVisibles(rol);

  return GRUPOS.map((grupo) => ({
    grupo,
    modulos: visibles.filter((modulo) => modulo.grupo === grupo),
  })).filter((seccion) => seccion.modulos.length > 0);
}

/** Rutas accesibles sin sesión iniciada. */
export const RUTAS_PUBLICAS = ["/login"] as const;

export function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

/** Módulo al que pertenece una ruta, o null si la ruta no es de un módulo. */
export function moduloDeRuta(pathname: string): Modulo | null {
  return (
    MODULOS.find(
      (modulo) =>
        pathname === modulo.href || pathname.startsWith(`${modulo.href}/`),
    ) ?? null
  );
}

export function puedeAccederRuta(rol: Rol, pathname: string): boolean {
  const modulo = moduloDeRuta(pathname);
  if (!modulo) return true; // rutas sin modulo (ej. "/") solo requieren sesion
  return modulo.roles.includes(rol);
}

/** Modulos visibles en la navegación para un rol. */
export function modulosVisibles(rol: Rol): readonly Modulo[] {
  return MODULOS.filter((modulo) => modulo.roles.includes(rol));
}

/** Landing por rol: a donde mandar después del login o ante un acceso denegado. */
export function rutaPorDefecto(rol: Rol): string {
  return rol === "ADMINISTRADOR" ? "/reportes" : "/caja";
}
