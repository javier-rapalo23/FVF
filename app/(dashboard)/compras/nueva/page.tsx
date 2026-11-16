import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { clasesBoton } from "@/components/ui/boton";
import { EncabezadoPagina, EstadoVacio, Volver } from "@/components/ui/pagina";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { textoMonto } from "@/lib/calculos";
import type { ProductoCompra } from "@/lib/compras/tipos";
import { DIAS_ATRAS_COMPRA } from "@/lib/config";
import { diaDelNegocio, sumarDias } from "@/lib/fecha";
import { prisma } from "@/lib/prisma";

import { FormularioCompra } from "../_components/formulario-compra";

export const metadata: Metadata = { title: "Nueva compra | Inversiones Ferrera" };

export default async function NuevaCompraPage() {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  const [proveedores, productos, sucursales] = await Promise.all([
    prisma.proveedor.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.producto.findMany({
      where: { activo: true },
      select: {
        id: true,
        idInterno: true,
        codigoBarras: true,
        nombre: true,
        unidadVenta: true,
        proveedorId: true,
        precioMinorista: true,
        precioMayorista: true,
        costoActual: true,
        categoria: { select: { nombre: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    // Solo hace falta elegir sucursal si el administrador no tiene una asignada.
    usuario.sucursalId === null
      ? prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } })
      : Promise.resolve([]),
  ]);

  const catalogo: ProductoCompra[] = productos.map((p) => ({
    id: p.id,
    idInterno: p.idInterno,
    codigoBarras: p.codigoBarras,
    nombre: p.nombre,
    categoria: p.categoria.nombre,
    unidadVenta: p.unidadVenta,
    proveedorId: p.proveedorId,
    precioMinorista: textoMonto(p.precioMinorista),
    precioMayorista: textoMonto(p.precioMayorista),
    costoActual: p.costoActual === null ? null : textoMonto(p.costoActual),
  }));

  const hoy = diaDelNegocio();

  return (
    <section>
      <Volver href="/compras">Compras</Volver>
      <EncabezadoPagina
        titulo="Nueva compra"
        descripcion="La mercadería entra al stock al guardar. Cantidades en la unidad de venta de cada producto y costos con ISV incluido."
      />

      {proveedores.length === 0 || catalogo.length === 0 ? (
        <EstadoVacio
          icono="compras"
          titulo={proveedores.length === 0 ? "No hay proveedores activos" : "No hay productos activos"}
          accion={
            <Link
              href={proveedores.length === 0 ? "/proveedores/nuevo" : "/productos/nuevo"}
              className={clasesBoton("primario")}
            >
              {proveedores.length === 0 ? "Cargar proveedor" : "Cargar producto"}
            </Link>
          }
        >
          Hace falta al menos un proveedor y un producto activos para registrar una compra.
        </EstadoVacio>
      ) : (
        <FormularioCompra
          usuarioId={usuario.id}
          proveedores={proveedores}
          productos={catalogo}
          sucursales={sucursales.length > 1 ? sucursales : []}
          hoy={hoy}
          fechaMinima={sumarDias(hoy, -DIAS_ATRAS_COMPRA)}
        />
      )}
    </section>
  );
}
