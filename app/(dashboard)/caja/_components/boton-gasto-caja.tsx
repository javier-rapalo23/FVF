"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/icono";
import { escuchar } from "@/lib/offline/eventos";

/**
 * Atajo al registro de un gasto pagado con el efectivo de la caja. Registrar un
 * gasto necesita el servidor (no se encola como las ventas): sin conexión el
 * botón queda deshabilitado y dice por qué.
 */
export function BotonGastoCaja() {
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
        title="Registrar un gasto necesita conexión"
        className={`${clasesBoton("secundario", "sm")} cursor-not-allowed opacity-50`}
      >
        <Icono nombre="gastos" tamano={15} />
        Gasto de caja · sin conexión
      </span>
    );
  }

  return (
    <Link href="/gastos/nuevo" className={clasesBoton("secundario", "sm")}>
      <Icono nombre="gastos" tamano={15} />
      Registrar gasto
    </Link>
  );
}
