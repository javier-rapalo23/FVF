"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icono } from "@/components/ui/icono";
import type { Modulo } from "@/lib/permissions";

/**
 * Navegación para pantallas chicas, donde la barra lateral no entra.
 * Tira horizontal desplazable: mantiene todos los módulos alcanzables sin
 * esconderlos detrás de un menú hamburguesa.
 */
export function NavMovil({ modulos }: { modulos: readonly Modulo[] }) {
  const pathname = usePathname();

  return (
    <nav className="no-imprimir flex gap-1.5 overflow-x-auto border-b border-borde bg-superficie px-4 py-2 md:hidden">
      {modulos.map((modulo) => {
        const activo =
          pathname === modulo.href || pathname.startsWith(`${modulo.href}/`);

        return (
          <Link
            key={modulo.href}
            href={modulo.href}
            aria-current={activo ? "page" : undefined}
            className={[
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px]",
              activo
                ? "border-borde bg-superficie-suave font-medium text-tinta"
                : "border-transparent text-tinta-media",
            ].join(" ")}
          >
            <span className={activo ? "text-marca-600" : "text-tinta-suave"}>
              <Icono nombre={modulo.icono} tamano={16} />
            </span>
            {modulo.label}
          </Link>
        );
      })}
    </nav>
  );
}
