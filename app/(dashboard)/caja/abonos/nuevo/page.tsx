import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EncabezadoPagina, EstadoVacio, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { textoMonto } from "@/lib/calculos";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";
import { saldosDeClientes } from "@/lib/ventas/saldo";

import { FormularioAbono } from "../_components/formulario-abono";

export const metadata: Metadata = { title: "Abono de cliente | Inversiones Ferrera" };

export default async function NuevoAbonoPage({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";
  const parametros = await leerParametros(searchParams);
  const clientePedido = /^\d{1,9}$/.test(parametros.cliente ?? "") ? Number(parametros.cliente) : null;

  // El administrador llega desde la ficha del cliente; el empleado, desde la caja.
  const volverA = esAdmin && clientePedido ? `/clientes/${clientePedido}` : "/caja";
  const encabezado = (
    <>
      <Volver href={volverA}>{volverA === "/caja" ? "Caja" : "Cliente"}</Volver>
      <EncabezadoPagina
        titulo="Abono de cliente"
        descripcion="Lo que un cliente paga de su cuenta de fiado. Al guardar se abre el comprobante para imprimir."
      />
    </>
  );

  if (!esAdmin && usuario.sucursalId === null) {
    return (
      <section>
        {encabezado}
        <EstadoVacio icono="tienda" titulo="Sin sucursal asignada">
          Tu usuario no tiene una sucursal. Pedile al administrador que te asigne una.
        </EstadoVacio>
      </section>
    );
  }

  const saldos = await saldosDeClientes(prisma);
  const deudores = [...saldos].filter(([, saldo]) => saldo.gt(0));
  const [registros, sucursales] = await Promise.all([
    prisma.cliente.findMany({
      where: { id: { in: deudores.map(([id]) => id) } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } }),
  ]);
  const clientes = registros.map((c) => ({ ...c, saldo: textoMonto(saldos.get(c.id)!) }));
  const sucursalPropia = sucursales.find((s) => s.id === usuario.sucursalId) ?? null;

  if (clientes.length === 0) {
    return (
      <section>
        {encabezado}
        <EstadoVacio icono="clientes" titulo="Ningún cliente debe nada">
          Los abonos son para las cuentas de fiado con saldo pendiente.
        </EstadoVacio>
      </section>
    );
  }

  const preseleccionado = clientes.some((c) => c.id === clientePedido) ? clientePedido : null;

  return (
    <section>
      {encabezado}
      {clientePedido && !preseleccionado ? (
        <p className="mb-4 max-w-4xl rounded-md bg-alerta-fondo px-3 py-2.5 text-[13px] text-alerta-tinta">
          Ese cliente no tiene deuda pendiente. Elegí otro de la lista.
        </p>
      ) : null}
      <FormularioAbono
        // La clave nace con la página: un doble envío del mismo formulario no duplica el abono.
        claveIdempotencia={randomUUID()}
        clientes={clientes}
        clienteInicial={preseleccionado}
        sucursalPropia={sucursalPropia}
        sucursales={sucursalPropia ? [] : sucursales}
        volverA={volverA}
      />
    </section>
  );
}
