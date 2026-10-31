import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Pestanas } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";

import { ColaPendientes } from "../_components/cola-pendientes";
import { PESTANAS_CAJA } from "../_components/pestanas";

export const metadata: Metadata = { title: "Ventas sin sincronizar | Inversiones Ferrera" };

/**
 * La cola vive en el dispositivo (IndexedDB): el servidor solo entrega la
 * estructura, que el service worker guarda para abrirla sin conexión.
 */
export default async function PendientesPage() {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  return (
    <section>
      <Pestanas items={PESTANAS_CAJA} activa="/caja/pendientes" />
      <ColaPendientes usuario={{ id: usuario.id, rol: usuario.rol }} />
    </section>
  );
}
