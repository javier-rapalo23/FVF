"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clasesBoton } from "@/components/ui/boton";
import { Icono, type NombreIcono } from "@/components/ui/icono";
import { escuchar } from "@/lib/offline/eventos";

/**
 * Atajo de la caja a una pantalla que necesita el servidor (registrar un gasto
 * o un abono: no se encolan como las ventas). Sin conexión el botón queda
 * deshabilitado y dice por qué.
 */
export function AtajoEnLinea({
  href,
  icono,
  texto,
  accion,
}: {
  href: string;
  icono: NombreIcono;
  texto: string;
  /** Qué se registra, para el aviso sin conexión: "un gasto", "un abono". */
  accion: string;
}) {
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    setEnLinea(navigator.onLine);
    const sinRed = () => setEnLinea(false);
    const conRed = () => setEnLinea(true);
    window.addEventListener("offline", sinRed);
    window.addEventListener("online", conRed);
    const dejar = escuchar((evento) => {
      if (evento.tipo === "red") setEnLinea(evento.enLinea);
    });
    return () => {
      window.removeEventListener("offline", sinRed);
      window.removeEventListener("online", conRed);
      dejar();
    };
  }, []);

  if (!enLinea) {
    return (
      <span
        aria-disabled="true"
        title={`Registrar ${accion} necesita conexión`}
        className={`${clasesBoton("secundario", "sm")} cursor-not-allowed opacity-50`}
      >
        <Icono nombre={icono} tamano={15} />
        {texto} · sin conexión
      </span>
    );
  }

  return (
    <Link href={href} className={clasesBoton("secundario", "sm")}>
      <Icono nombre={icono} tamano={15} />
      {texto}
    </Link>
  );
}
