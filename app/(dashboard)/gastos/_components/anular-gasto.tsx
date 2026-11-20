"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { MINIMO_MOTIVO_ANULACION, type EfectoAnulacion } from "@/lib/gastos/tipos";

import { anularGastoAccion } from "../actions";

/** Qué cambia al anular, según el medio y si el gasto ya entró en un cierre (sección 3.7). */
function textoEfecto(efecto: EfectoAnulacion) {
  switch (efecto.tipo) {
    case "CAJA_PENDIENTE":
      return "Deja de restar en el próximo cierre de caja.";
    case "CAJA_CERRADA":
      return (
        <>
          Ya entró en el{" "}
          <Link href={`/cierres/${efecto.cierreId}`} className="underline underline-offset-2">
            cierre N° {efecto.cierreId}
          </Link>
          , que no cambia: ese cierre ya se contó con lo que había en el cajón. Tampoco se reintegra
          en el cierre siguiente.
        </>
      );
    case "OTRO_MEDIO":
      return "Solo deja de contar en los gastos del período. No toca ningún cierre de caja.";
  }
}

/** Anulación del gasto. Solo se renderiza para el administrador. */
export function AnularGasto({ gastoId, efecto }: { gastoId: number; efecto: EfectoAnulacion }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    if (pendiente) return;
    setAbierto(false);
    setError(null);
  }

  function confirmar() {
    if (motivo.trim().length < MINIMO_MOTIVO_ANULACION) {
      setError(`Escribí el motivo (al menos ${MINIMO_MOTIVO_ANULACION} caracteres).`);
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const resultado = await anularGastoAccion(gastoId, motivo.trim());
        if (!resultado.ok) {
          setError(resultado.mensaje);
          return;
        }
        setAbierto(false);
        router.refresh();
      } catch {
        setError("Sin conexión con el servidor. El gasto no se anuló.");
      }
    });
  }

  return (
    <>
      <Boton variante="peligro" onClick={() => setAbierto(true)}>
        Anular gasto
      </Boton>

      <Dialogo abierto={abierto} onCerrar={cerrar} titulo={`Anular gasto N° ${gastoId}`}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-tinta-media">
            El gasto queda registrado como anulado y deja de sumar en los totales. {textoEfecto(efecto)}
          </p>
          {efecto.tipo === "CAJA_CERRADA" ? (
            <p className="flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2.5 text-[13px] leading-snug text-alerta-tinta">
              <span className="mt-px shrink-0">
                <Icono nombre="alerta" tamano={15} />
              </span>
              Si el dinero en realidad no salió de la caja, aquel cierre mostró un sobrante: explicalo
              en su revisión.
            </p>
          ) : null}

          <AlertaFormulario mensaje={error} />

          <GrupoCampo etiqueta="Motivo" htmlFor="motivo-anulacion-gasto">
            <textarea
              id="motivo-anulacion-gasto"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={500}
              data-autofocus
              placeholder="Ej.: registrado dos veces, monto equivocado"
              className={`py-2 ${CLASES_INPUT}`}
            />
          </GrupoCampo>

          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton variante="fantasma" onClick={cerrar} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={confirmar} disabled={pendiente}>
              {pendiente ? "Anulando…" : "Confirmar anulación"}
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
