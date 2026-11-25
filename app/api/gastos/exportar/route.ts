import { redirect } from "next/navigation";

import { requerirUsuarioActivo } from "@/lib/acceso";
import { textoMonto } from "@/lib/calculos";
import { armarCsv } from "@/lib/csv";
import { fecha } from "@/lib/formato";
import { filtroDeGastos } from "@/lib/gastos/listado";
import { NOMBRE_CATEGORIA, NOMBRE_MEDIO } from "@/lib/gastos/tipos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ENCABEZADO = [
  "Fecha",
  "Concepto",
  "Categoría",
  "Descripción",
  "Comprobante",
  "Sucursal",
  "Medio",
  "Usuario",
  "Monto",
  "Estado",
] as const;

/**
 * Exporta a CSV las filas del filtro del listado de gastos, sin paginar
 * (sección 6.4). El middleware no cubre /api: la sesión se valida acá, y el
 * filtro es el mismo del listado, así el empleado solo exporta lo que ve.
 */
export async function GET(request: Request) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  if (usuario.rol !== "ADMINISTRADOR" && usuario.sucursalId === null) {
    return new Response("Tu usuario no tiene una sucursal asignada.", { status: 403 });
  }

  const parametros = Object.fromEntries(
    [...new URL(request.url).searchParams.entries()].map(([clave, valor]) => [clave, valor.trim()]),
  );
  const filtro = filtroDeGastos(usuario, parametros);

  const gastos = await prisma.gasto.findMany({
    where: filtro.where,
    select: {
      fecha: true,
      monto: true,
      medioPago: true,
      descripcion: true,
      numeroComprobante: true,
      anulado: true,
      concepto: { select: { nombre: true, categoria: true } },
      sucursal: { select: { nombre: true } },
      usuario: { select: { nombre: true } },
    },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
  });

  const csv = armarCsv(
    ENCABEZADO,
    gastos.map((g) => [
      fecha(g.fecha),
      g.concepto.nombre,
      NOMBRE_CATEGORIA[g.concepto.categoria],
      g.descripcion,
      g.numeroComprobante ?? "",
      g.sucursal?.nombre ?? "General",
      NOMBRE_MEDIO[g.medioPago],
      g.usuario.nombre,
      // Sin separador de miles y con punto decimal, como se escriben los montos en el negocio.
      textoMonto(g.monto),
      g.anulado ? "Anulado" : "Vigente",
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos_${filtro.desde}_a_${filtro.hasta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
