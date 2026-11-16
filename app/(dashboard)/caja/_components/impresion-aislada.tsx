"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { VentaPendiente } from "@/lib/offline/tipos";

import { Comprobante, type DatosComprobante } from "./comprobante";

/** Comprobante de una venta que todavía no tiene número (pendiente de sincronizar). */
export function comprobanteDePendiente(venta: VentaPendiente): DatosComprobante {
  return {
    id: null,
    fecha: new Date(venta.fechaCliente),
    sucursal: venta.resumen.sucursalNombre,
    cajero: venta.resumen.usuarioNombre,
    cliente: venta.resumen.clienteNombre,
    canal: venta.payload.canal,
    notas: venta.payload.notas,
    metodoPago: venta.payload.metodoPago,
    total: venta.resumen.total,
    anulada: false,
    lineas: venta.resumen.lineas.map((linea, i) => ({
      id: i,
      producto: linea.nombre,
      unidadVenta: linea.unidadVenta,
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario,
      subtotal: linea.subtotal,
    })),
  };
}

/**
 * Imprime un comprobante sin salir de la pantalla actual. Sin conexión no se
 * puede abrir /caja/ventas/[id], así que el ticket se monta al final del
 * `body` y, mientras se imprime, todo lo demás se oculta (`.imprimir-aislado`).
 */
export function ImpresionAislada({
  datos,
  onTerminar,
}: {
  datos: DatosComprobante | null;
  onTerminar: () => void;
}) {
  useEffect(() => {
    if (!datos) return;

    const cuerpo = document.body;
    cuerpo.classList.add("imprimir-aislado");

    const terminar = () => {
      cuerpo.classList.remove("imprimir-aislado");
      onTerminar();
    };
    window.addEventListener("afterprint", terminar, { once: true });
    const cuadro = requestAnimationFrame(() => window.print());

    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("afterprint", terminar);
      cuerpo.classList.remove("imprimir-aislado");
    };
  }, [datos, onTerminar]);

  if (!datos) return null;

  return createPortal(
    <div className="zona-impresion hidden print:block">
      <style>{"@media print { @page { margin: 4mm; } }"}</style>
      <Comprobante venta={datos} />
    </div>,
    document.body,
  );
}
