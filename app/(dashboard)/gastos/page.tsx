import type { CategoriaGasto, MedioPagoGasto, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { EncabezadoPagina, EstadoVacio, Pestanas, Tarjeta } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { aDecimal } from "@/lib/calculos";
import { diaDelNegocio, esDiaValido, inicioYFinDelDia, sumarDias } from "@/lib/fecha";
import { fecha, formatoMoneda } from "@/lib/formato";
import {
  CATEGORIAS_GASTO,
  MEDIOS_GASTO,
  NOMBRE_CATEGORIA,
  NOMBRE_MEDIO,
} from "@/lib/gastos/tipos";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { PESTANAS_GASTOS } from "./_components/pestanas";

export const metadata: Metadata = { title: "Gastos | Inversiones Ferrera" };

const POR_PAGINA = 50;
/** Lo que ve el empleado: los gastos de caja de su sucursal de los últimos días. */
const DIAS_EMPLEADO = 30;

export default async function GastosPage({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");
  const esAdmin = usuario.rol === "ADMINISTRADOR";

  const parametros = await leerParametros(searchParams);
  const hoy = diaDelNegocio();
  const pagina = Math.max(1, Number(parametros.pagina) || 1);

  const nuevoGasto = (
    <Link href="/gastos/nuevo" className={clasesBoton("primario")}>
      <Icono nombre="mas" tamano={16} />
      {esAdmin ? "Nuevo gasto" : "Registrar gasto de caja"}
    </Link>
  );
  const encabezado = (
    <EncabezadoPagina
      titulo="Gastos"
      descripcion={
        esAdmin
          ? "Lo que se paga y no es mercadería que entra al stock. Los gastos pagados con el efectivo de la caja se descuentan en el cierre."
          : `Gastos pagados con el efectivo de la caja de tu sucursal, de los últimos ${DIAS_EMPLEADO} días. Se descuentan en el próximo cierre.`
      }
      acciones={esAdmin || usuario.sucursalId !== null ? nuevoGasto : null}
    />
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

  // ---------------------------------------------------------------- Filtros
  const desde = esAdmin
    ? esDiaValido(parametros.desde ?? "")
      ? parametros.desde!
      : `${hoy.slice(0, 8)}01`
    : sumarDias(hoy, -DIAS_EMPLEADO);
  const hasta = esAdmin && esDiaValido(parametros.hasta ?? "") ? parametros.hasta! : hoy;
  const sucursal = esAdmin ? (parametros.sucursal ?? "") : "";
  const categoria = CATEGORIAS_GASTO.find((c) => c === parametros.categoria) ?? null;
  const conceptoId = esAdmin && /^\d{1,9}$/.test(parametros.concepto ?? "") ? Number(parametros.concepto) : null;
  const medio = esAdmin ? (MEDIOS_GASTO.find((m) => m === parametros.medio) ?? null) : null;
  const incluirAnulados = !esAdmin || parametros.anulados === "1";

  const base: Prisma.GastoWhereInput = {
    fecha: { gte: inicioYFinDelDia(desde).inicio, lt: inicioYFinDelDia(hasta).fin },
  };
  if (esAdmin) {
    if (sucursal === "general") base.sucursalId = null;
    else if (/^\d{1,9}$/.test(sucursal)) base.sucursalId = Number(sucursal);
    if (categoria) base.concepto = { categoria };
    if (conceptoId) base.conceptoId = conceptoId;
    if (medio) base.medioPago = medio;
  } else {
    base.sucursalId = usuario.sucursalId;
    base.medioPago = "EFECTIVO_CAJA";
  }
  const where: Prisma.GastoWhereInput = { ...base, ...(incluirAnulados ? {} : { anulado: false }) };

  const [gastos, cantidad, porConcepto, conceptos, sucursales, hayGastos] = await Promise.all([
    prisma.gasto.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        monto: true,
        medioPago: true,
        descripcion: true,
        anulado: true,
        cierreCajaId: true,
        concepto: { select: { nombre: true, categoria: true } },
        sucursal: { select: { nombre: true } },
        usuario: { select: { nombre: true } },
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.gasto.count({ where }),
    // Los anulados nunca suman, aunque se muestren.
    prisma.gasto.groupBy({
      by: ["conceptoId"],
      where: { ...base, anulado: false },
      _sum: { monto: true },
    }),
    prisma.conceptoGasto.findMany({
      select: { id: true, nombre: true, categoria: true },
      orderBy: { nombre: "asc" },
    }),
    esAdmin
      ? prisma.sucursal.findMany({ select: { id: true, nombre: true }, orderBy: { id: "asc" } })
      : [],
    prisma.gasto.count({
      where: esAdmin ? {} : { sucursalId: usuario.sucursalId, medioPago: "EFECTIVO_CAJA" },
      take: 1,
    }),
  ]);

  const categoriaDe = new Map(conceptos.map((c) => [c.id, c.categoria]));
  const porCategoria = new Map<CategoriaGasto, Prisma.Decimal>();
  for (const fila of porConcepto) {
    const cat = categoriaDe.get(fila.conceptoId);
    if (!cat) continue;
    porCategoria.set(cat, (porCategoria.get(cat) ?? aDecimal(0)).plus(fila._sum.monto ?? 0));
  }
  const total = [...porCategoria.values()].reduce((suma, v) => suma.plus(v), aDecimal(0));
  const paginas = Math.max(1, Math.ceil(cantidad / POR_PAGINA));

  const filtrando =
    Boolean(parametros.desde || parametros.hasta || sucursal || categoria || conceptoId || medio) ||
    parametros.anulados === "1";

  function enlacePagina(destino: number): string {
    const p = new URLSearchParams();
    for (const clave of ["desde", "hasta", "sucursal", "categoria", "concepto", "medio", "anulados"]) {
      const valor = parametros[clave];
      if (valor) p.set(clave, valor);
    }
    if (destino > 1) p.set("pagina", String(destino));
    const consulta = p.toString();
    return consulta ? `/gastos?${consulta}` : "/gastos";
  }

  const registrado = /^\d{1,9}$/.test(parametros.registrado ?? "") ? Number(parametros.registrado) : null;

  return (
    <section>
      {encabezado}
      {esAdmin ? <Pestanas items={PESTANAS_GASTOS} activa="/gastos" /> : null}

      {registrado ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-exito-fondo px-3.5 py-2.5 text-[13px] text-exito-tinta"
        >
          <Icono nombre="check" tamano={15} />
          <span>
            Gasto <span className="cifras font-medium">N° {registrado}</span> registrado.
          </span>
          <span className="ml-auto flex gap-3">
            <Link href={`/gastos/${registrado}`} className="font-medium underline underline-offset-2">
              Ver
            </Link>
            <Link href="/gastos/nuevo" className="font-medium underline underline-offset-2">
              Registrar otro
            </Link>
          </span>
        </div>
      ) : null}

      {hayGastos === 0 ? (
        <EstadoVacio icono="gastos" titulo="Todavía no hay gastos" accion={nuevoGasto}>
          {esAdmin
            ? "Registrá el primero: alquiler, luz, salarios, un flete."
            : "Cuando pagues algo con el efectivo de la caja, registralo acá para que el cierre cuadre."}
        </EstadoVacio>
      ) : (
        <>
          {esAdmin ? (
            <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
              <Filtro etiqueta="Desde">
                <input
                  type="date"
                  name="desde"
                  defaultValue={desde}
                  max={hoy}
                  className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
                />
              </Filtro>
              <Filtro etiqueta="Hasta">
                <input
                  type="date"
                  name="hasta"
                  defaultValue={hasta}
                  max={hoy}
                  className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
                />
              </Filtro>
              {sucursales.length > 0 ? (
                <Filtro etiqueta="Sucursal">
                  <select
                    name="sucursal"
                    defaultValue={sucursal}
                    className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
                  >
                    <option value="">Todas</option>
                    <option value="general">General</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </Filtro>
              ) : null}
              <Filtro etiqueta="Categoría">
                <select
                  name="categoria"
                  defaultValue={categoria ?? ""}
                  className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
                >
                  <option value="">Todas</option>
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c}>
                      {NOMBRE_CATEGORIA[c]}
                    </option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Concepto">
                <select
                  name="concepto"
                  defaultValue={conceptoId ?? ""}
                  className={`h-9 w-auto max-w-[220px] text-[13px] ${CLASES_SELECT_SUELTO}`}
                >
                  <option value="">Todos</option>
                  {conceptos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Medio">
                <select
                  name="medio"
                  defaultValue={medio ?? ""}
                  className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
                >
                  <option value="">Todos</option>
                  {MEDIOS_GASTO.map((m) => (
                    <option key={m} value={m}>
                      {NOMBRE_MEDIO[m]}
                    </option>
                  ))}
                </select>
              </Filtro>
              <label className="flex h-9 items-center gap-2 px-1 text-[13px] text-tinta-media">
                <input
                  type="checkbox"
                  name="anulados"
                  value="1"
                  defaultChecked={incluirAnulados}
                  className="h-4 w-4 accent-marca-600"
                />
                Incluir anulados
              </label>
              <Boton type="submit">Filtrar</Boton>
              {filtrando ? (
                <Link href="/gastos" className={clasesBoton("fantasma")}>
                  Limpiar
                </Link>
              ) : null}
            </form>
          ) : null}

          <Tarjeta className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Total gastado
              </p>
              <p className="cifras text-[24px] font-semibold tracking-[-0.02em] text-tinta">
                {formatoMoneda(total)}
              </p>
            </div>
            {CATEGORIAS_GASTO.map((c) =>
              porCategoria.has(c) ? (
                <div key={c} className="cifras text-[13px]">
                  <span className="text-tinta-suave">{NOMBRE_CATEGORIA[c]} </span>
                  <span className="text-tinta">{formatoMoneda(porCategoria.get(c)!)}</span>
                </div>
              ) : null,
            )}
            <p className="text-[12px] text-tinta-suave">
              {fecha(new Date(`${desde}T12:00:00.000Z`))} al {fecha(new Date(`${hasta}T12:00:00.000Z`))}
            </p>
          </Tarjeta>

          {gastos.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ningún gasto coincide con los filtros.
            </EstadoVacio>
          ) : (
            <>
              <Tabla
                columnas={[
                  { label: "N°" },
                  { label: "Fecha" },
                  { label: "Concepto" },
                  { label: "Descripción", ocultaMovil: true },
                  ...(esAdmin ? [{ label: "Sucursal", ocultaMovil: true }] : []),
                  { label: "Medio", ocultaMovil: true },
                  { label: "Registró", ocultaMovil: true },
                  { label: "Monto", derecha: true },
                ]}
              >
                {gastos.map((gasto) => (
                  <Fila key={gasto.id} atenuada={gasto.anulado}>
                    <Celda className="cifras font-mono">
                      <Link
                        href={`/gastos/${gasto.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {gasto.id}
                      </Link>
                    </Celda>
                    <Celda className="cifras whitespace-nowrap text-tinta-media">
                      {fecha(gasto.fecha)}
                    </Celda>
                    <Celda>
                      <span className="block">{gasto.concepto.nombre}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Etiqueta>{NOMBRE_CATEGORIA[gasto.concepto.categoria]}</Etiqueta>
                        {gasto.anulado ? <Etiqueta tono="peligro">Anulado</Etiqueta> : null}
                      </span>
                    </Celda>
                    <Celda ocultaMovil className="max-w-[280px] text-tinta-media">
                      <span className="line-clamp-2">{gasto.descripcion}</span>
                    </Celda>
                    {esAdmin ? (
                      <Celda ocultaMovil className="text-tinta-media">
                        {gasto.sucursal?.nombre ?? "General"}
                      </Celda>
                    ) : null}
                    <Celda ocultaMovil className="whitespace-nowrap text-tinta-media">
                      <MedioPago medio={gasto.medioPago} cerrado={gasto.cierreCajaId !== null} />
                    </Celda>
                    <Celda ocultaMovil className="text-tinta-media">
                      {gasto.usuario.nombre}
                    </Celda>
                    <Celda
                      derecha
                      className={`cifras whitespace-nowrap font-medium ${gasto.anulado ? "line-through" : ""}`}
                    >
                      {formatoMoneda(gasto.monto)}
                    </Celda>
                  </Fila>
                ))}
              </Tabla>

              <div className="mt-3 flex items-center justify-between text-[12px] text-tinta-suave">
                <span>
                  {cantidad} {cantidad === 1 ? "gasto" : "gastos"}
                  {paginas > 1 ? ` · página ${pagina} de ${paginas}` : ""}
                </span>
                {paginas > 1 ? (
                  <div className="flex gap-2">
                    {pagina > 1 ? (
                      <Link href={enlacePagina(pagina - 1)} className={clasesBoton("secundario", "sm")}>
                        Anterior
                      </Link>
                    ) : null}
                    {pagina < paginas ? (
                      <Link href={enlacePagina(pagina + 1)} className={clasesBoton("secundario", "sm")}>
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

function Filtro({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[11px] text-tinta-suave">{etiqueta}</span>
      {children}
    </label>
  );
}

function MedioPago({ medio, cerrado }: { medio: MedioPagoGasto; cerrado: boolean }) {
  if (medio !== "EFECTIVO_CAJA") return <>{NOMBRE_MEDIO[medio]}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {NOMBRE_MEDIO[medio]}
      {cerrado ? null : <Etiqueta tono="info">Sin cierre</Etiqueta>}
    </span>
  );
}
