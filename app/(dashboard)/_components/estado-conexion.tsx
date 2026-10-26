"use client";

import type { Rol } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { contarPendientes } from "@/lib/offline/cola";
import { escuchar } from "@/lib/offline/eventos";
import { iniciarMotor } from "@/lib/offline/motor";

/** Cada cuánto, como mucho, se vuelven a guardar las páginas de caja para usar sin red. */
const PRECALENTAR_CADA_MS = 10 * 60_000;
const CLAVE_PRECALENTADO = "ferrera:sw:precalentado";

/**
 * Indicador permanente de conexión y ventas pendientes. Además es quien
 * arranca, para toda la app, el service worker y la sincronización de la cola.
 */
export function EstadoConexion({ usuario }: { usuario: { id: number; rol: Rol } }) {
  const [enLinea, setEnLinea] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [sesionVencida, setSesionVencida] = useState(false);

  // Motor de sincronización.
  useEffect(() => iniciarMotor({ usuarioId: usuario.id, rol: usuario.rol }), [usuario.id, usuario.rol]);

  // Estado de red y cola.
  useEffect(() => {
    setEnLinea(navigator.onLine);
    void contarPendientes().then(setPendientes);

    const sinRed = () => setEnLinea(false);
    const conRed = () => setEnLinea(true);
    window.addEventListener("offline", sinRed);
    window.addEventListener("online", conRed);

    const dejarDeEscuchar = escuchar((evento) => {
      if (evento.tipo === "cola") void contarPendientes().then(setPendientes);
      if (evento.tipo === "red") setEnLinea(evento.enLinea);
      if (evento.tipo === "sesion") setSesionVencida(evento.vencida);
    });

    return () => {
      window.removeEventListener("offline", sinRed);
      window.removeEventListener("online", conRed);
      dejarDeEscuchar();
    };
  }, []);

  // Service worker. En desarrollo no: cachearía código que cambia a cada guardado.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW_DEV !== "1") return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((registro) => {
        if (!navigator.onLine) return;
        let ultimo = 0;
        try {
          ultimo = Number(sessionStorage.getItem(CLAVE_PRECALENTADO)) || 0;
          if (Date.now() - ultimo < PRECALENTAR_CADA_MS) return;
          sessionStorage.setItem(CLAVE_PRECALENTADO, String(Date.now()));
        } catch {
          // Sin sessionStorage se precalienta en cada carga; no es grave.
        }
        registro.active?.postMessage({ tipo: "precalentar" });
      })
      .catch(() => {
        // Sin service worker la caja anda online; solo no abre sin conexión.
      });
  }, []);

  return (
    <div className="flex items-center gap-2">
      {sesionVencida ? (
        <Link
          href="/login"
          className="rounded-md bg-peligro-fondo px-2 py-1 text-[12px] font-medium text-peligro-tinta"
        >
          Sesión vencida: iniciar sesión
        </Link>
      ) : null}

      {pendientes > 0 ? (
        <Link
          href="/caja/pendientes"
          title="Ventas cobradas sin conexión que todavía no llegaron al servidor"
          className="cifras rounded-md bg-alerta-fondo px-2 py-1 text-[12px] font-medium text-alerta-tinta transition-colors duration-150 hover:bg-[#f6e9c2]"
        >
          {pendientes} pendiente{pendientes === 1 ? "" : "s"}
        </Link>
      ) : null}

      <span
        role="status"
        className={[
          "flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]",
          enLinea ? "text-tinta-media" : "bg-peligro-fondo font-medium text-peligro-tinta",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${enLinea ? "bg-marca-500" : "bg-peligro-tinta"}`}
        />
        <span className={enLinea ? "hidden sm:inline" : ""}>
          {enLinea ? "En línea" : "Sin conexión"}
        </span>
      </span>
    </div>
  );
}
