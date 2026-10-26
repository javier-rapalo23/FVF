"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Segmentado } from "@/components/ui/segmentado";
import type { RespuestaError } from "@/lib/ventas/tipos";

/**
 * Botón de impresión del comprobante. Con `automatico` (la caja abre el
 * detalle con `?imprimir=1`), dispara el diálogo de impresión al cargar.
 */
export function BotonImprimir({ automatico }: { automatico: boolean }) {
  const disparado = useRef(false);

  useEffect(() => {
    if (!automatico || disparado.current) return;
    disparado.current = true;
    // Un frame de margen para que el navegador termine de pintar el ticket.
    requestAnimationFrame(() => window.print());
  }, [automatico]);

  return (
    <Boton variante="primario" onClick={() => window.print()}>
      <Icono nombre="imprimir" tamano={16} />
      Imprimir
    </Boton>
  );
}

/** Anulación de la venta completa. Solo se renderiza para el administrador. */
export function AnularVenta({ ventaId, esFiado }: { ventaId: number; esFiado: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [reingresa, setReingresa] = useState<"" | "si" | "no">("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    if (enviando) return;
    setAbierto(false);
    setError(null);
  }

  async function confirmar() {
    if (motivo.trim().length < 3) {
      setError("Escribí el motivo (al menos 3 caracteres).");
      return;
    }
    if (!reingresa) {
      setError("Indicá si el producto vuelve al stock.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/ventas/${ventaId}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim(), reingresaStock: reingresa === "si" }),
      });

      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json().catch(() => null)) as RespuestaError | null;
        setError(cuerpo?.mensaje ?? `No se pudo anular (${respuesta.status}).`);
        return;
      }

      setAbierto(false);
      router.refresh();
    } catch {
      setError("Sin conexión con el servidor. La venta no se anuló.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Boton variante="peligro" onClick={() => setAbierto(true)}>
        Anular venta
      </Boton>

      <Dialogo abierto={abierto} onCerrar={cerrar} titulo={`Anular venta N° ${ventaId}`}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-tinta-media">
            La venta queda registrada con la marca de anulada y deja de sumar en los totales.
            {esFiado ? " Como fue fiado, se descuenta el total del saldo del cliente." : ""}
          </p>

          <AlertaFormulario mensaje={error} />

          <GrupoCampo etiqueta="Motivo" htmlFor="motivo-anulacion">
            <textarea
              id="motivo-anulacion"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={500}
              data-autofocus
              placeholder="Ej.: cobro duplicado, el cliente devolvió la mercadería"
              className={`py-2 ${CLASES_INPUT}`}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="¿El producto vuelve al stock?">
            <Segmentado
              etiqueta="¿El producto vuelve al stock?"
              valor={reingresa}
              onCambio={setReingresa}
              opciones={[
                { valor: "si", label: "Sí, vuelve" },
                { valor: "no", label: "No vuelve" },
              ]}
            />
          </GrupoCampo>

          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton variante="fantasma" onClick={cerrar} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={() => void confirmar()} disabled={enviando}>
              {enviando ? "Anulando…" : "Confirmar anulación"}
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
