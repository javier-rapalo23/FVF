import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { Tarjeta, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { textoMonto } from "@/lib/calculos";
import { saldoDespuesDeAbono } from "@/lib/cuentas/estado-cuenta";
import { NOMBRE_MEDIO_ABONO } from "@/lib/cuentas/tipos";
import { formatoFechaHora } from "@/lib/fecha";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { BotonImprimir } from "../../_components/acciones-venta";
import { ComprobanteAbono } from "../../_components/comprobante-abono";

export const metadata: Metadata = { title: "Abono | Inversiones Ferrera" };

export default async function AbonoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  const { id } = await params;
  const abonoId = /^\d{1,9}$/.test(id) ? Number(id) : null;
  if (!abonoId) notFound();

  const abono = await prisma.movimientoCuenta.findUnique({
    where: { id: abonoId },
    select: {
      id: true,
      tipo: true,
      fecha: true,
      monto: true,
      medioPago: true,
      nota: true,
      clienteId: true,
      sucursalId: true,
      cierreCajaId: true,
      cliente: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
    },
  });
  const esAdmin = usuario.rol === "ADMINISTRADOR";
  // Un empleado solo ve los abonos de su sucursal.
  if (
    !abono ||
    abono.tipo !== "ABONO" ||
    (!esAdmin && (abono.sucursalId === null || abono.sucursalId !== usuario.sucursalId))
  ) {
    notFound();
  }

  const { imprimir } = await leerParametros(searchParams);
  const saldoPendiente = await saldoDespuesDeAbono(abono.clienteId, abono.id);
  const medio = abono.medioPago ? NOMBRE_MEDIO_ABONO[abono.medioPago] : "—";

  return (
    <section>
      {/* Márgenes del papel del comprobante: solo existen en esta pantalla. */}
      <style>{"@media print { @page { margin: 4mm; } }"}</style>

      <div className="no-imprimir">
        <Volver href={esAdmin ? `/clientes/${abono.clienteId}` : "/caja"}>
          {esAdmin ? abono.cliente.nombre : "Caja"}
        </Volver>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <h1 className="cifras text-[22px] font-semibold tracking-[-0.02em] text-tinta">
            Abono N° {abono.id}
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/caja/abonos/nuevo" className={clasesBoton("secundario")}>
              Registrar otro
            </Link>
            <BotonImprimir automatico={imprimir === "1"} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <ComprobanteAbono
          abono={{
            id: abono.id,
            fecha: abono.fecha,
            sucursal: abono.sucursal?.nombre ?? null,
            cajero: abono.usuario?.nombre ?? "—",
            cliente: abono.cliente.nombre,
            medio,
            monto: textoMonto(abono.monto),
            saldoPendiente,
            nota: abono.nota,
          }}
        />

        <div className="no-imprimir min-w-0 max-w-md flex-1">
          <Tarjeta className="px-5 py-4">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
              <dt className="text-tinta-suave">Fecha</dt>
              <dd className="cifras text-tinta">{formatoFechaHora(abono.fecha)}</dd>
              <dt className="text-tinta-suave">Medio</dt>
              <dd className="text-tinta">{medio}</dd>
              <dt className="text-tinta-suave">Caja</dt>
              <dd className="text-tinta">{abono.sucursal?.nombre ?? "—"}</dd>
              {abono.medioPago === "EFECTIVO" ? (
                <>
                  <dt className="text-tinta-suave">Cierre</dt>
                  <dd className="text-tinta">
                    {abono.cierreCajaId ? (
                      <Link
                        href={`/cierres/${abono.cierreCajaId}`}
                        className="cifras underline-offset-2 hover:underline"
                      >
                        N° {abono.cierreCajaId}
                      </Link>
                    ) : (
                      "Pendiente del próximo cierre"
                    )}
                  </dd>
                </>
              ) : null}
            </dl>
          </Tarjeta>
        </div>
      </div>
    </section>
  );
}
