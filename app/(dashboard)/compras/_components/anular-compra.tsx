"use client";

import type { UnidadVenta } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, GrupoCampo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { AlertaFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { cantidad } from "@/lib/formato";

import { anularCompraAccion } from "../actions";

type Negativo = { nombre: string; stock: string; unidadVenta: UnidadVenta };

/** Anulación de la compra completa. Solo se renderiza para el administrador. */
export function AnularCompra({ compraId, esCredito }: { compraId: number; esCredito: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [negativos, setNegativos] = useState<Negativo[] | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    if (pendiente) return;
    setAbierto(false);
    setError(null);
    if (negativos) {
      setNegativos(null);
      router.refresh();
    }
  }

  function confirmar() {
    if (motivo.trim().length < 5) {
      setError("Escribí el motivo (al menos 5 caracteres).");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const resultado = await anularCompraAccion(compraId, motivo.trim());
        if (!resultado.ok) {
          setError(resultado.mensaje);
          return;
        }
        if (resultado.stockNegativo.length > 0) {
          // Se queda abierto para mostrar el aviso; al cerrar se refresca.
          setNegativos(resultado.stockNegativo);
          return;
        }
        setAbierto(false);
        router.refresh();
      } catch {
        setError("Sin conexión con el servidor. La compra no se anuló.");
      }
    });
  }

  return (
    <>
      <Boton variante="peligro" onClick={() => setAbierto(true)}>
        Anular compra
      </Boton>

      <Dialogo abierto={abierto} onCerrar={cerrar} titulo={`Anular compra N° ${compraId}`}>
        {negativos ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-md bg-alerta-fondo px-3 py-2.5 text-[13px] leading-snug text-alerta-tinta">
              <span className="mt-px shrink-0">
                <Icono nombre="alerta" tamano={15} />
              </span>
              La compra se anuló, pero parte de la mercadería ya se había vendido y estos productos
              quedaron con stock negativo:
            </p>
            <ul className="space-y-1 text-[13px]">
              {negativos.map((n) => (
                <li key={n.nombre} className="flex justify-between gap-3">
                  <span className="text-tinta">{n.nombre}</span>
                  <span className="cifras text-peligro-tinta">
                    {cantidad(n.stock, n.unidadVenta)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end border-t border-borde pt-4">
              <Boton variante="primario" onClick={cerrar} data-autofocus>
                Entendido
              </Boton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-tinta-media">
              La compra queda registrada como anulada y deja de sumar en los totales. Se resta del
              stock lo que había ingresado.
              {esCredito ? " Como fue a crédito, se descuenta el total del saldo del proveedor." : ""}{" "}
              El último costo de los productos no cambia.
            </p>

            <AlertaFormulario mensaje={error} />

            <GrupoCampo etiqueta="Motivo" htmlFor="motivo-anulacion-compra">
              <textarea
                id="motivo-anulacion-compra"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                rows={3}
                maxLength={500}
                data-autofocus
                placeholder="Ej.: factura cargada dos veces, cantidades equivocadas"
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
        )}
      </Dialogo>
    </>
  );
}
