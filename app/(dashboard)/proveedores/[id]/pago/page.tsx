import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EncabezadoPagina, EstadoVacio, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { textoMonto } from "@/lib/calculos";
import { esperadosActuales } from "@/lib/cierres/calcular";
import { saldoDeProveedor } from "@/lib/compras/saldo";
import { prisma } from "@/lib/prisma";

import { registrarPagoAccion } from "./actions";
import { FormularioPago } from "./formulario-pago";

export const metadata: Metadata = { title: "Pago a proveedor | Inversiones Ferrera" };

export default async function PagoProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  // La ruta ya es solo de administrador (middleware); igual se confirma contra la base.
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  if (usuario.rol !== "ADMINISTRADOR") notFound();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const proveedor = await prisma.proveedor.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  });
  if (!proveedor) notFound();

  const [saldo, sucursales] = await Promise.all([
    saldoDeProveedor(prisma, proveedor.id),
    prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } }),
  ]);
  const sucursalPropia = sucursales.find((s) => s.id === usuario.sucursalId) ?? null;
  const cajas = sucursalPropia ? [sucursalPropia] : sucursales;
  const volverA = `/proveedores/${proveedor.id}`;

  return (
    <section>
      <Volver href={volverA}>{proveedor.nombre}</Volver>
      <EncabezadoPagina
        titulo="Pago a proveedor"
        descripcion="Lo que se le paga de las compras a crédito. Solo el efectivo de caja se descuenta en el cierre."
      />
      {saldo.gt(0) ? (
        <FormularioPago
          accion={registrarPagoAccion.bind(null, proveedor.id)}
          // La clave nace con la página: un doble envío del mismo formulario no duplica el pago.
          claveIdempotencia={randomUUID()}
          saldo={textoMonto(saldo)}
          sucursalPropia={sucursalPropia}
          sucursales={sucursalPropia ? [] : sucursales}
          esperados={await esperadosActuales(
            prisma,
            cajas.map((s) => s.id),
          )}
          volverA={volverA}
        />
      ) : (
        <EstadoVacio icono="proveedores" titulo="No hay saldo por pagar">
          No se le debe nada a {proveedor.nombre}: no hay compras a crédito pendientes.
        </EstadoVacio>
      )}
    </section>
  );
}
