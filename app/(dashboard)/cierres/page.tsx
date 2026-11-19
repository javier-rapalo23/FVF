import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { EncabezadoPagina, EstadoVacio } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { diaDelNegocio, esDiaValido, formatoFechaHora, inicioYFinDelDia, sumarDias } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Cierres de caja | Inversiones Ferrera",
};

const POR_PAGINA = 50;
const DIAS_POR_DEFECTO = 30;

export default async function CierresPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  const cerrarCaja = (
    <Link href="/cierres/nuevo" className={clasesBoton("primario")}>
      <Icono nombre="cierres" tamano={16} />
      Cerrar caja
    </Link>
  );

  if (!esAdmin && usuario.sucursalId === null) {
    return (
      <section>
        <EncabezadoPagina titulo="Cierres de caja" />
        <EstadoVacio icono="tienda" titulo="Sin sucursal asignada">
          Tu usuario no tiene una sucursal. Pedile al administrador que te asigne una.
        </EstadoVacio>
      </section>
    );
  }

  const parametros = await leerParametros(searchParams);
  const hoy = diaDelNegocio();
  // El empleado ve su sucursal y el último mes; el administrador filtra.
  const desde =
    esAdmin && esDiaValido(parametros.desde ?? "") ? parametros.desde! : sumarDias(hoy, -DIAS_POR_DEFECTO);
  const hasta = esAdmin && esDiaValido(parametros.hasta ?? "") ? parametros.hasta! : hoy;
  const sucursalFiltro = !esAdmin
    ? usuario.sucursalId
    : /^\d{1,9}$/.test(parametros.sucursal ?? "")
      ? Number(parametros.sucursal)
      : null;
  const soloSinRevisar = esAdmin && parametros.revision === "pendientes";
  const pagina = Math.max(1, Number(parametros.pagina) || 1);

  const rango: Prisma.CierreCajaWhereInput = {
    fecha: { gte: inicioYFinDelDia(desde).inicio, lt: inicioYFinDelDia(hasta).fin },
    ...(sucursalFiltro ? { sucursalId: sucursalFiltro } : {}),
  };
  const where: Prisma.CierreCajaWhereInput = {
    ...rango,
    ...(soloSinRevisar ? { revisadoPorId: null } : {}),
  };

  const [cierres, cantidad, sinRevisar, sucursales, hayCierres] = await Promise.all([
    prisma.cierreCaja.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        totalSistema: true,
        totalContado: true,
        diferencia: true,
        cantidadVentas: true,
        revisadoPorId: true,
        sucursal: { select: { nombre: true } },
        usuario: { select: { nombre: true } },
      },
      orderBy: { id: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.cierreCaja.count({ where }),
    esAdmin ? prisma.cierreCaja.count({ where: { ...rango, revisadoPorId: null } }) : Promise.resolve(0),
    esAdmin
      ? prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } })
      : Promise.resolve([]),
    prisma.cierreCaja.count({
      where: esAdmin ? {} : { sucursalId: usuario.sucursalId! },
      take: 1,
    }),
  ]);

  const paginas = Math.max(1, Math.ceil(cantidad / POR_PAGINA));
  const mostrarSucursal = sucursales.length > 1;

  function enlace(cambios: Record<string, string | null>): string {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = {
      desde: parametros.desde ? desde : null,
      hasta: parametros.hasta ? hasta : null,
      sucursal: esAdmin && sucursalFiltro ? String(sucursalFiltro) : null,
      revision: soloSinRevisar ? "pendientes" : null,
      ...cambios,
    };
    for (const [clave, valor] of Object.entries(base)) if (valor) p.set(clave, valor);
    const query = p.toString();
    return query ? `/cierres?${query}` : "/cierres";
  }

  return (
    <section>
      <EncabezadoPagina
        titulo="Cierres de caja"
        descripcion={
          esAdmin
            ? "Arqueos de caja: efectivo esperado, contado y diferencia. Revisá los que tengan diferencias."
            : "Tus cierres y los de tu sucursal del último mes."
        }
        acciones={cerrarCaja}
      />

      {hayCierres === 0 ? (
        <EstadoVacio icono="cierres" titulo="Todavía no hay cierres" accion={cerrarCaja}>
          Al terminar el turno, contá el efectivo del cajón y registrá el cierre: el sistema lo compara
          con las ventas.
        </EstadoVacio>
      ) : (
        <>
          {esAdmin ? (
            <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="block text-[11px] text-tinta-suave">Desde</span>
                <input
                  type="date"
                  name="desde"
                  defaultValue={desde}
                  max={hoy}
                  className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] text-tinta-suave">Hasta</span>
                <input
                  type="date"
                  name="hasta"
                  defaultValue={hasta}
                  max={hoy}
                  className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
                />
              </label>
              {mostrarSucursal ? (
                <label className="space-y-1">
                  <span className="block text-[11px] text-tinta-suave">Sucursal</span>
                  <select
                    name="sucursal"
                    defaultValue={sucursalFiltro ?? ""}
                    className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
                  >
                    <option value="">Todas</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex h-9 items-center gap-2 px-1 text-[13px] text-tinta-media">
                <input
                  type="checkbox"
                  name="revision"
                  value="pendientes"
                  defaultChecked={soloSinRevisar}
                  className="h-4 w-4 accent-marca-600"
                />
                Solo sin revisar
                {sinRevisar > 0 ? (
                  <span className="cifras text-[12px] text-tinta-suave">({sinRevisar})</span>
                ) : null}
              </label>
              <Boton type="submit">Filtrar</Boton>
              {parametros.desde || parametros.hasta || parametros.sucursal || soloSinRevisar ? (
                <Link href="/cierres" className={clasesBoton("fantasma")}>
                  Limpiar
                </Link>
              ) : null}
            </form>
          ) : null}

          {cierres.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ningún cierre coincide con los filtros.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                columnas={[
                  { label: "N°" },
                  { label: "Fecha" },
                  ...(mostrarSucursal ? [{ label: "Sucursal", ocultaMovil: true }] : []),
                  { label: "Usuario", ocultaMovil: true },
                  { label: "Ventas", derecha: true, ocultaMovil: true },
                  { label: "Esperado", derecha: true, ocultaMovil: true },
                  { label: "Contado", derecha: true, ocultaMovil: true },
                  { label: "Diferencia", derecha: true },
                  { label: "Revisión" },
                ]}
              >
                {cierres.map((c) => (
                  <Fila key={c.id}>
                    <Celda className="cifras font-mono">
                      <Link
                        href={`/cierres/${c.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {c.id}
                      </Link>
                    </Celda>
                    <Celda className="cifras whitespace-nowrap text-tinta-media">
                      {formatoFechaHora(c.fecha)}
                    </Celda>
                    {mostrarSucursal ? (
                      <Celda ocultaMovil className="text-tinta-media">
                        {c.sucursal.nombre}
                      </Celda>
                    ) : null}
                    <Celda ocultaMovil className="text-tinta-media">
                      {c.usuario.nombre}
                    </Celda>
                    <Celda derecha ocultaMovil className="cifras text-tinta-media">
                      {c.cantidadVentas}
                    </Celda>
                    <Celda derecha ocultaMovil className="cifras whitespace-nowrap text-tinta-media">
                      {formatoMoneda(c.totalSistema)}
                    </Celda>
                    <Celda derecha ocultaMovil className="cifras whitespace-nowrap">
                      {formatoMoneda(c.totalContado)}
                    </Celda>
                    <Celda
                      derecha
                      className={`cifras whitespace-nowrap font-medium ${
                        c.diferencia.gt(0)
                          ? "text-exito-tinta"
                          : c.diferencia.lt(0)
                            ? "text-peligro-tinta"
                            : "text-tinta-suave"
                      }`}
                    >
                      {c.diferencia.isZero() ? "Cuadra" : formatoMoneda(c.diferencia)}
                    </Celda>
                    <Celda>
                      {c.revisadoPorId ? (
                        <Etiqueta tono="exito">Revisado</Etiqueta>
                      ) : (
                        <Etiqueta>Sin revisar</Etiqueta>
                      )}
                    </Celda>
                  </Fila>
                ))}
              </Tabla>

              <div className="mt-3 flex items-center justify-between text-[12px] text-tinta-suave">
                <span>
                  {cantidad} {cantidad === 1 ? "cierre" : "cierres"}
                  {paginas > 1 ? ` · página ${pagina} de ${paginas}` : ""}
                </span>
                {paginas > 1 ? (
                  <div className="flex gap-2">
                    {pagina > 1 ? (
                      <Link
                        href={enlace({ pagina: pagina - 1 > 1 ? String(pagina - 1) : null })}
                        className={clasesBoton("secundario", "sm")}
                      >
                        Anterior
                      </Link>
                    ) : null}
                    {pagina < paginas ? (
                      <Link
                        href={enlace({ pagina: String(pagina + 1) })}
                        className={clasesBoton("secundario", "sm")}
                      >
                        Siguiente
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
