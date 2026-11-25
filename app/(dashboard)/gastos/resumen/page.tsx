import type { CategoriaGasto, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Boton, clasesBoton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, EstadoVacio, Pestanas, Tarjeta } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { aDecimal } from "@/lib/calculos";
import { DIAS_ATRAS_COMPRA } from "@/lib/config";
import {
  diaDelNegocio,
  diasDelMes,
  esMesValido,
  formatoMes,
  sumarDias,
  sumarMeses,
} from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import { gastosFijosDelMes } from "@/lib/gastos/fijos";
import { resumenDeGastos, variacion } from "@/lib/gastos/resumen";
import { NOMBRE_CATEGORIA, NOMBRE_MEDIO } from "@/lib/gastos/tipos";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { EtiquetaEstadoFijo, enlaceRegistrarFijo } from "../fijos/_components/estado-fijo";
import { PESTANAS_GASTOS } from "../_components/pestanas";

export const metadata: Metadata = { title: "Resumen de gastos | Inversiones Ferrera" };

const PORCENTAJE = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 1 });
const CERO = aDecimal(0);

/** Parte de un total, en porcentaje (0 si el total es cero). */
function parte(valor: Prisma.Decimal, total: Prisma.Decimal): number {
  return total.isZero() ? 0 : valor.div(total).mul(100).toNumber();
}

/** Solo administrador: la ruta tiene su propio permiso en `lib/permissions.ts`. */
export default async function ResumenGastosPage({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const parametros = await leerParametros(searchParams);
  const hoy = diaDelNegocio();
  const mesActual = hoy.slice(0, 7);

  const mes =
    esMesValido(parametros.mes ?? "") && parametros.mes! <= mesActual ? parametros.mes! : mesActual;
  const mesAnterior = sumarMeses(mes, -1);
  const periodo = diasDelMes(mes);
  const periodoAnterior = diasDelMes(mesAnterior);

  const sucursales = await prisma.sucursal.findMany({
    select: { id: true, nombre: true },
    orderBy: { id: "asc" },
  });
  // `undefined` = todas; `null` = solo los gastos generales.
  const sucursal = parametros.sucursal ?? "";
  const sucursalId: number | null | undefined =
    sucursal === "general"
      ? null
      : sucursales.some((s) => String(s.id) === sucursal)
        ? Number(sucursal)
        : undefined;
  const sucursalElegida = sucursalId === undefined ? "" : sucursalId === null ? "general" : String(sucursalId);

  const [actual, anterior, fijos] = await Promise.all([
    resumenDeGastos(prisma, { ...periodo, sucursalId }),
    resumenDeGastos(prisma, { ...periodoAnterior, sucursalId }),
    gastosFijosDelMes(prisma, { mes, sucursalId, hoy }),
  ]);

  const cambio = variacion(actual.total, anterior.total);

  // Conceptos con gastos en cualquiera de los dos meses, ordenados por el mes elegido.
  const anteriorPorConcepto = new Map(anterior.porConcepto.map((c) => [c.conceptoId, c]));
  const filasConcepto: {
    conceptoId: number;
    nombre: string;
    categoria: CategoriaGasto;
    mes: Prisma.Decimal;
    anterior: Prisma.Decimal;
  }[] = actual.porConcepto.map((c) => ({
    conceptoId: c.conceptoId,
    nombre: c.nombre,
    categoria: c.categoria,
    mes: c.total,
    anterior: anteriorPorConcepto.get(c.conceptoId)?.total ?? CERO,
  }));
  const conIds = new Set(filasConcepto.map((f) => f.conceptoId));
  for (const c of anterior.porConcepto) {
    if (!conIds.has(c.conceptoId)) {
      filasConcepto.push({ conceptoId: c.conceptoId, nombre: c.nombre, categoria: c.categoria, mes: CERO, anterior: c.total });
    }
  }

  // Enlace al listado con el mismo período y sucursal: sus totales tienen que coincidir.
  const consultaListado = new URLSearchParams({
    desde: periodo.desde,
    hasta: periodo.hasta < hoy ? periodo.hasta : hoy,
    ...(sucursalElegida ? { sucursal: sucursalElegida } : {}),
  }).toString();

  // Registrar un fijo de un mes pasado propone su día de pago, si todavía entra en el límite de fechas.
  const diaMinimo = sumarDias(hoy, -DIAS_ATRAS_COMPRA);
  const diaParaRegistrar = (diaDelMes: number): string | null | undefined => {
    if (mes === mesActual) return undefined;
    const dia = `${mes}-${String(diaDelMes).padStart(2, "0")}`;
    return dia >= diaMinimo ? dia : null;
  };

  const nombreAnterior = formatoMes(mesAnterior);

  return (
    <section>
      <EncabezadoPagina
        titulo="Gastos"
        descripcion="Cuánto se gastó en el mes, en qué y dónde, comparado con el mes anterior. Los gastos anulados no suman."
      />
      <Pestanas items={PESTANAS_GASTOS} activa="/gastos/resumen" />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <Filtro etiqueta="Mes">
          <input
            type="month"
            name="mes"
            defaultValue={mes}
            max={mesActual}
            className={`h-9 w-auto text-[13px] ${CLASES_INPUT}`}
          />
        </Filtro>
        {sucursales.length > 0 ? (
          <Filtro etiqueta="Sucursal">
            <select
              name="sucursal"
              defaultValue={sucursalElegida}
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
        <Boton type="submit">Ver</Boton>
        {mes !== mesActual || sucursalElegida ? (
          <Link href="/gastos/resumen" className={clasesBoton("fantasma")}>
            Mes actual
          </Link>
        ) : null}
      </form>

      {/* ------------------------------------------------------------ Total */}
      <Tarjeta className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
            Total de {formatoMes(mes)}
          </p>
          <p className="cifras text-[24px] font-semibold tracking-[-0.02em] text-tinta">
            {formatoMoneda(actual.total)}
          </p>
        </div>
        <div className="text-[13px]">
          <p className="text-tinta-suave">
            {nombreAnterior}: <span className="cifras text-tinta">{formatoMoneda(anterior.total)}</span>
          </p>
          <p className="cifras mt-0.5">
            <Diferencia valor={cambio.diferencia} />
            {cambio.porcentaje ? (
              <span className="text-tinta-suave">
                {" "}
                ({cambio.porcentaje.gt(0) ? "+" : ""}
                {PORCENTAJE.format(cambio.porcentaje.toNumber())} %)
              </span>
            ) : anterior.total.isZero() && !actual.total.isZero() ? (
              <span className="text-tinta-suave"> (sin gastos el mes anterior)</span>
            ) : null}
          </p>
        </div>
        <p className="text-[12px] text-tinta-suave">
          {actual.cantidad} {actual.cantidad === 1 ? "gasto" : "gastos"}
        </p>
        <Link href={`/gastos?${consultaListado}`} className={`ml-auto ${clasesBoton("secundario", "sm")}`}>
          Ver en el listado
        </Link>
      </Tarjeta>

      {/* ------------------------------------------------------- Gastos fijos */}
      {fijos.length > 0 ? (
        <Bloque titulo={`Gastos fijos de ${formatoMes(mes)}`}>
          <Tabla
            columnas={[
              { label: "Día" },
              { label: "Gasto" },
              { label: "Sucursal", ocultaMovil: true },
              { label: "Estimado", derecha: true, ocultaMovil: true },
              { label: "Estado" },
              { label: "Registrado", derecha: true },
            ]}
          >
            {fijos.map((fijo) => {
              const dia = diaParaRegistrar(fijo.diaDelMes);
              const total = fijo.registrados.reduce((suma, g) => suma.plus(g.monto), CERO);
              return (
                <Fila key={fijo.id}>
                  <Celda className="cifras text-tinta-media">{fijo.diaDelMes}</Celda>
                  <Celda>
                    <span className="block font-medium">{fijo.descripcion}</span>
                    <span className="text-[12px] text-tinta-media">
                      {fijo.concepto.nombre} · {NOMBRE_MEDIO[fijo.medioPago]}
                    </span>
                  </Celda>
                  <Celda ocultaMovil className="text-tinta-media">
                    {fijo.sucursal?.nombre ?? "General"}
                  </Celda>
                  <Celda derecha ocultaMovil className="cifras whitespace-nowrap text-tinta-media">
                    {formatoMoneda(fijo.montoEstimado)}
                  </Celda>
                  <Celda>
                    <EtiquetaEstadoFijo estado={fijo.estado} />
                  </Celda>
                  <Celda derecha className="whitespace-nowrap">
                    {fijo.registrados.length > 0 ? (
                      <Link
                        href={`/gastos/${fijo.registrados[0]!.id}`}
                        className="cifras font-medium underline-offset-2 hover:underline"
                      >
                        {formatoMoneda(total)}
                      </Link>
                    ) : dia !== null ? (
                      <Link
                        href={enlaceRegistrarFijo(fijo.id, dia)}
                        className={clasesBoton(fijo.estado === "ATRASADO" ? "primario" : "secundario", "sm")}
                      >
                        Registrar
                      </Link>
                    ) : (
                      <span className="text-[12px] text-tinta-suave">Fuera de plazo</span>
                    )}
                  </Celda>
                </Fila>
              );
            })}
          </Tabla>
        </Bloque>
      ) : null}

      {actual.cantidad === 0 && anterior.cantidad === 0 ? (
        <EstadoVacio icono="gastos" titulo="Sin gastos en estos meses">
          No hay gastos registrados en {formatoMes(mes)} ni en {nombreAnterior}
          {sucursalElegida ? " para esta sucursal" : ""}.
        </EstadoVacio>
      ) : (
        <>
          {/* ---------------------------------------------------- Por categoría */}
          <Bloque titulo="Por categoría">
            <Tarjeta className="space-y-3 px-5 py-4">
              {actual.porCategoria.map((c) => {
                const porcentaje = parte(c.total, actual.total);
                return (
                  <div key={c.categoria} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px] sm:grid-cols-[140px_1fr_auto]">
                    <span className="text-tinta-media">{NOMBRE_CATEGORIA[c.categoria]}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-superficie-suave" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-marca-500"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </span>
                    <span className="cifras whitespace-nowrap text-right">
                      {formatoMoneda(c.total)}
                      <span className="ml-2 inline-block w-12 text-tinta-suave">
                        {PORCENTAJE.format(porcentaje)} %
                      </span>
                    </span>
                  </div>
                );
              })}
            </Tarjeta>
          </Bloque>

          {/* ----------------------------------------------------- Por concepto */}
          <Bloque titulo="Por concepto">
            <Tabla
              columnas={[
                { label: "Concepto" },
                { label: formatoMes(mes), derecha: true },
                { label: nombreAnterior, derecha: true, ocultaMovil: true },
                { label: "Diferencia", derecha: true },
              ]}
            >
              {filasConcepto.map((fila) => (
                <Fila key={fila.conceptoId}>
                  <Celda>
                    <span className="mr-2">{fila.nombre}</span>
                    <Etiqueta>{NOMBRE_CATEGORIA[fila.categoria]}</Etiqueta>
                  </Celda>
                  <Celda derecha className="cifras whitespace-nowrap font-medium">
                    {formatoMoneda(fila.mes)}
                  </Celda>
                  <Celda derecha ocultaMovil className="cifras whitespace-nowrap text-tinta-media">
                    {formatoMoneda(fila.anterior)}
                  </Celda>
                  <Celda derecha className="cifras whitespace-nowrap">
                    <Diferencia valor={fila.mes.minus(fila.anterior)} />
                  </Celda>
                </Fila>
              ))}
            </Tabla>
          </Bloque>

          {/* ----------------------------------------------------- Por sucursal */}
          {sucursalId === undefined && actual.porSucursal.length > 0 ? (
            <Bloque titulo="Por sucursal">
              <Tabla
                columnas={[
                  { label: "Sucursal" },
                  { label: "Total", derecha: true },
                  { label: "% del mes", derecha: true },
                ]}
              >
                {actual.porSucursal.map((s) => (
                  <Fila key={s.sucursalId ?? "general"}>
                    <Celda>{s.nombre}</Celda>
                    <Celda derecha className="cifras whitespace-nowrap font-medium">
                      {formatoMoneda(s.total)}
                    </Celda>
                    <Celda derecha className="cifras whitespace-nowrap text-tinta-media">
                      {PORCENTAJE.format(parte(s.total, actual.total))} %
                    </Celda>
                  </Fila>
                ))}
              </Tabla>
            </Bloque>
          ) : null}
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

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">{titulo}</h2>
      {children}
    </div>
  );
}

/** Diferencia contra el mes anterior: más gasto en tono de alerta, menos en tono de éxito. */
function Diferencia({ valor }: { valor: Prisma.Decimal }) {
  if (valor.isZero()) return <span className="text-tinta-suave">Sin cambio</span>;
  const sube = valor.gt(0);
  return (
    <span className={sube ? "text-alerta-tinta" : "text-exito-tinta"}>
      {sube ? "+" : ""}
      {formatoMoneda(valor)}
    </span>
  );
}
