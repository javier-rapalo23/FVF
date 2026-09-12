"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icono } from "@/components/ui/icono";
import type { GrupoModulo, Modulo } from "@/lib/permissions";

type Seccion = { grupo: GrupoModulo; modulos: readonly Modulo[] };

export function NavLateral({ secciones }: { secciones: readonly Seccion[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {secciones.map(({ grupo, modulos }) => (
        <div key={grupo} className="space-y-1">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-tinta-suave">
            {grupo}
          </p>

          {modulos.map((modulo) => {
            const activo =
              pathname === modulo.href || pathname.startsWith(`${modulo.href}/`);

            return (
              <Link
                key={modulo.href}
                href={modulo.href}
                aria-current={activo ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-[13px]",
                  "transition-colors duration-150",
                  activo
                    ? // El activo se marca con superficie y verde en el icono,
                      // no con un bloque de color: el verde queda reservado.
                      "border-borde bg-superficie font-medium text-tinta shadow-sutil"
                    : "border-transparent text-tinta-media hover:bg-superficie-suave hover:text-tinta",
                ].join(" ")}
              >
                <span className={activo ? "text-marca-600" : "text-tinta-suave"}>
                  <Icono nombre={modulo.icono} />
                </span>
                {modulo.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
