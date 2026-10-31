"use client";

import { useEffect, useState } from "react";

import { Icono } from "@/components/ui/icono";

type Tema = "claro" | "oscuro";

/**
 * Alterna entre modo claro y oscuro. El tema vive en `data-tema` del <html>
 * (lo fija el script de app/layout.tsx antes de pintar) y la elección se
 * guarda en el dispositivo, no en el usuario: cada caja puede tener su luz.
 */
export function AlternarTema() {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    setTema(document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro");
  }, []);

  function alternar() {
    const siguiente: Tema = tema === "oscuro" ? "claro" : "oscuro";
    document.documentElement.dataset.tema = siguiente;
    try {
      localStorage.setItem("tema", siguiente);
    } catch {
      // Sin almacenamiento el cambio dura hasta recargar.
    }
    setTema(siguiente);
  }

  const etiqueta = tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={alternar}
      title={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-md text-tinta-suave transition-colors duration-150 hover:bg-superficie-suave hover:text-tinta"
    >
      {/* Antes de montar no se sabe el tema: se reserva el lugar sin icono. */}
      {tema ? <Icono nombre={tema === "oscuro" ? "sol" : "luna"} /> : null}
      <span className="sr-only">{etiqueta}</span>
    </button>
  );
}
