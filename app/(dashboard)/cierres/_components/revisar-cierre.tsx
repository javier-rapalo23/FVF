"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { AlertaFormulario } from "@/components/ui/formulario";

import { revisarCierreAccion } from "../actions";

/** Revisión del administrador. Solo se renderiza para él. */
export function RevisarCierre({ cierreId }: { cierreId: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await revisarCierreAccion(cierreId, nota.trim());
        if (!r.ok) {
          setError(r.mensaje);
          return;
        }
        setAbierto(false);
        router.refresh();
      } catch {
        setError("Sin conexión con el servidor. La revisión no se guardó.");
      }
    });
  }

  return (
    <>
      <Boton variante="primario" onClick={() => setAbierto(true)}>
        Marcar como revisado
      </Boton>
      <Dialogo
        abierto={abierto}
        onCerrar={() => !pendiente && setAbierto(false)}
        titulo={`Revisar cierre N° ${cierreId}`}
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-tinta-media">
            La revisión deja constancia de que viste el cierre. No cambia ningún importe: si hay un
            error, se corrige en el cierre siguiente.
          </p>
          <AlertaFormulario mensaje={error} />
          <GrupoCampo etiqueta="Nota (opcional)" htmlFor="nota-revision">
            <textarea
              id="nota-revision"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              maxLength={500}
              data-autofocus
              placeholder="Ej.: faltante explicado, se descuenta del sueldo"
              className={`py-2 ${CLASES_INPUT}`}
            />
          </GrupoCampo>
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton variante="fantasma" onClick={() => setAbierto(false)} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={confirmar} disabled={pendiente}>
              {pendiente ? "Guardando…" : "Confirmar revisión"}
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
