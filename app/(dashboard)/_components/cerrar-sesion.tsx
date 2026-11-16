"use client";

import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Icono } from "@/components/ui/icono";
import { borrarCatalogosDe } from "@/lib/offline/catalogo-local";
import { contarPendientes } from "@/lib/offline/cola";

/**
 * Cierre de sesión. Si quedan ventas sin sincronizar avisa antes: no se
 * pierden (siguen en el dispositivo y se sincronizan al volver a entrar),
 * pero el cajero tiene que saberlo.
 *
 * Al salir se borran del dispositivo el catálogo de este usuario (tiene saldos
 * de clientes) y las páginas de caja guardadas por el service worker.
 */
export function CerrarSesion({
  accion,
  usuarioId,
}: {
  accion: () => Promise<void>;
  usuarioId: number;
}) {
  const [aviso, setAviso] = useState<number | null>(null);
  const [saliendo, startTransition] = useTransition();

  function salir() {
    startTransition(async () => {
      await borrarCatalogosDe(usuarioId);
      try {
        for (const nombre of await caches.keys()) {
          if (nombre.startsWith("ferrera-paginas-")) await caches.delete(nombre);
        }
      } catch {
        // Sin Cache API no hay páginas guardadas que borrar.
      }
      await accion();
    });
  }

  async function intentarSalir() {
    const pendientes = await contarPendientes();
    if (pendientes > 0) setAviso(pendientes);
    else salir();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void intentarSalir()}
        disabled={saliendo}
        title="Cerrar sesión"
        className="flex h-8 w-8 items-center justify-center rounded-md text-tinta-suave transition-colors duration-150 hover:bg-superficie-suave hover:text-tinta disabled:opacity-50"
      >
        <Icono nombre="salir" />
        <span className="sr-only">Cerrar sesión</span>
      </button>

      <Dialogo
        abierto={aviso !== null}
        onCerrar={() => setAviso(null)}
        titulo="Hay ventas sin sincronizar"
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-tinta-media">
            {aviso === 1 ? "Queda 1 venta" : `Quedan ${aviso} ventas`} cobradas sin conexión que
            todavía no llegaron al servidor. Se conservan en este dispositivo y se sincronizan
            cuando vuelvas a entrar con conexión.
          </p>
          <div className="flex justify-end gap-2">
            <Boton variante="fantasma" onClick={() => setAviso(null)} data-autofocus>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={salir} disabled={saliendo}>
              Cerrar sesión igual
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
