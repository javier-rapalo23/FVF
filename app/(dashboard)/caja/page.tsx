import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Pestanas } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { prisma } from "@/lib/prisma";

import { PantallaCaja } from "./_components/pantalla-caja";
import { PESTANAS_CAJA } from "./_components/pestanas";

export const metadata: Metadata = { title: "Caja / Ventas | Inversiones Ferrera" };

export default async function CajaPage() {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  // Solo un administrador sin sucursal fija elige dónde vende. El catálogo y
  // los productos los trae la propia pantalla desde /api/caja/catalogo.
  const sucursales =
    usuario.rol === "ADMINISTRADOR" && usuario.sucursalId === null
      ? await prisma.sucursal.findMany({
          select: { id: true, nombre: true },
          orderBy: { id: "asc" },
        })
      : [];

  return (
    <section>
      <Pestanas items={PESTANAS_CAJA} activa="/caja" />
      <PantallaCaja usuario={{ id: usuario.id, rol: usuario.rol }} sucursales={sucursales} />
    </section>
  );
}
