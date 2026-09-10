"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Modulo } from "@/lib/permissions";

export function NavLateral({ modulos }: { modulos: readonly Modulo[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {modulos.map((modulo) => {
        const activo =
          pathname === modulo.href || pathname.startsWith(`${modulo.href}/`);

        return (
          <Link
            key={modulo.href}
            href={modulo.href}
            aria-current={activo ? "page" : undefined}
            className={
              activo
                ? "block rounded-md bg-marca-600 px-3 py-2 text-sm font-medium text-white"
                : "block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            }
          >
            {modulo.label}
          </Link>
        );
      })}
    </nav>
  );
}
