"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import {
  MAXIMO_MOTIVO_ANULACION_CUENTA,
  MINIMO_MOTIVO_ANULACION_CUENTA,
  type EfectoAnulacionCuenta,
  type ResultadoAnulacionCuenta,
} from "@/lib/cuentas/tipos";
import { formatoMoneda } from "@/lib/formato";

type Movimiento = "abono" | "pago";

/** Qué cambia en la caja al anular, según el medio y si ya entró en un cierre. */
function textoEfecto(efecto: EfectoAnulacionCuenta, movimiento: Movimiento) {
  const verbo = movimiento === "abono" ? "sumar" : "restar";
  switch (efecto.tipo) {
    case "CAJA_PENDIENTE":
      return `Deja de ${verbo} en el próximo cierre de caja.`;
    case "CAJA_CERRADA":
      return (
        <>
          Ya entró en el{" "}
          <Link href={`/cierres/${efecto.cierreId}`} className="underline underline-offset-2">
            cierre N° {efecto.cierreId}
          </Link>
          , que no cambia: ese cierre ya se contó con lo que había en el cajón. Tampoco se corrige en
          el cierre siguiente.
        </>
      );
    case "OTRO_MEDIO":
      return "No toca ningún cierre de caja.";
  }
}

/**
 * Anulación de un abono de cliente o de un pago a proveedor, con motivo. Solo
 * se renderiza para el administrador; la acción llega ya atada al movimiento.
 */
export function AnularMovimiento({
  movimiento,
  id,
  monto,
  efecto,
  accion,
  compacto = false,
}: {
  movimiento: Movimiento;
  id: number;
  monto: string;
  efecto: EfectoAnulacionCuenta;
  accion: (motivo: string) => Promise<ResultadoAnulacionCuenta>;
  /** Botón chico, para usarlo dentro de una fila de tabla. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const nombre = movimiento === "abono" ? "abono" : "pago";
  const efectoSaldo =
    movimiento === "abono"
      ? `El cliente vuelve a deber ${formatoMoneda(monto)}.`
      : `Al proveedor se le vuelven a deber ${formatoMoneda(monto)}.`;

  function cerrar() {
    if (pendiente) return;
    setAbierto(false);
    setError(null);
  }

  function confirmar() {
    if (motivo.trim().length < MINIMO_MOTIVO_ANULACION_CUENTA) {
      setError(`Escribí el motivo (al menos ${MINIMO_MOTIVO_ANULACION_CUENTA} caracteres).`);
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const resultado = await accion(motivo.trim());
        if (!resultado.ok) {
          setError(resultado.mensaje);
          return;
        }
        setAbierto(false);
        setMotivo("");
        router.refresh();
      } catch {
        setError(`Sin conexión con el servidor. El ${nombre} no se anuló.`);
      }
    });
  }

  return (
    <>
      <Boton
        variante={compacto ? "fantasma" : "peligro"}
        tamano={compacto ? "sm" : "md"}
        className={compacto ? "text-peligro-tinta hover:text-peligro-tinta" : undefined}
        onClick={() => setAbierto(true)}
      >
        {compacto ? "Anular" : `Anular ${nombre}`}
      </Boton>

      <Dialogo abierto={abierto} onCerrar={cerrar} titulo={`Anular ${nombre} N° ${id}`}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-tinta-media">
            El {nombre} queda en el estado de cuenta marcado como anulado. {efectoSaldo}{" "}
            {textoEfecto(efecto, movimiento)}
          </p>
          {efecto.tipo === "CAJA_CERRADA" ? (
            <p className="flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2.5 text-[13px] leading-snug text-alerta-tinta">
              <span className="mt-px shrink-0">
                <Icono nombre="alerta" tamano={15} />
              </span>
              Si el dinero en realidad no {movimiento === "abono" ? "entró a" : "salió de"} la caja,
              aquel cierre mostró una diferencia: explicala en su revisión.
            </p>
          ) : null}

          <AlertaFormulario mensaje={error} />

          <GrupoCampo etiqueta="Motivo" htmlFor={`motivo-anulacion-${nombre}-${id}`}>
            <textarea
              id={`motivo-anulacion-${nombre}-${id}`}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={MAXIMO_MOTIVO_ANULACION_CUENTA}
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
