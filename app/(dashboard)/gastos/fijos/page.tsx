import type { Metadata } from "next";
import Link from "next/link";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, EncabezadoPagina, EstadoVacio, Pestanas } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { mesDelNegocio } from "@/lib/fecha";
import { formatoMoneda } from "@/lib/formato";
import { gastosFijosDelMes } from "@/lib/gastos/fijos";
import { NOMBRE_CATEGORIA, NOMBRE_MEDIO } from "@/lib/gastos/tipos";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { prisma } from "@/lib/prisma";

import { PESTANAS_GASTOS } from "../_components/pestanas";
import { EtiquetaEstadoFijo, enlaceRegistrarFijo } from "./_components/estado-fijo";

export const metadata: Metadata = { title: "Gastos fijos | Inversiones Ferrera" };

/** Solo administrador: la ruta tiene su propio permiso en `lib/permissions.ts`. */
export default async function GastosFijosPage({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const { guardado } = await leerParametros(searchParams);
  const mes = mesDelNegocio();

  const [fijos, delMes] = await Promise.all([
    prisma.gastoFijo.findMany({
      select: {
        id: true,
        descripcion: true,
        montoEstimado: true,
        diaDelMes: true,
        medioPago: true,
        activo: true,
        concepto: { select: { nombre: true, categoria: true } },
        sucursal: { select: { nombre: true } },
      },
      orderBy: [{ activo: "desc" }, { diaDelMes: "asc" }, { id: "asc" }],
    }),
    gastosFijosDelMes(prisma, { mes }),
  ]);
  const estadoDe = new Map(delMes.map((f) => [f.id, f]));

  const nuevo = (
    <Link href="/gastos/fijos/nuevo" className={clasesBoton("primario")}>
      <Icono nombre="mas" tamano={16} />
      Nuevo gasto fijo
    </Link>
  );

  return (
    <section>
      <EncabezadoPagina
        titulo="Gastos"
        descripcion="Lo que se paga todos los meses: alquiler, salarios, servicios. Es un recordatorio con plantilla: nada se registra solo."
        acciones={nuevo}
      />
      <Pestanas items={PESTANAS_GASTOS} activa="/gastos/fijos" />
      <AvisoGuardado nombre={guardado} />

      {fijos.length === 0 ? (
        <EstadoVacio icono="gastos" titulo="Todavía no hay gastos fijos" accion={nuevo}>
          Cargá lo que se paga todos los meses y el resumen te avisa cuál falta registrar.
        </EstadoVacio>
      ) : (
        <Tabla
          columnas={[
            { label: "Día" },
            { label: "Gasto" },
            { label: "Sucursal", ocultaMovil: true },
            { label: "Medio", ocultaMovil: true },
            { label: "Estimado", derecha: true },
            { label: "Este mes" },
            { label: "Acciones", derecha: true },
          ]}
        >
          {fijos.map((fijo) => {
            const delMes = estadoDe.get(fijo.id);
            return (
              <Fila key={fijo.id} atenuada={!fijo.activo}>
                <Celda className="cifras whitespace-nowrap text-tinta-media">{fijo.diaDelMes}</Celda>
                <Celda>
                  <span className="block font-medium">{fijo.descripcion}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-tinta-media">
                    {fijo.concepto.nombre}
                    <Etiqueta>{NOMBRE_CATEGORIA[fijo.concepto.categoria]}</Etiqueta>
                  </span>
                </Celda>
                <Celda ocultaMovil className="text-tinta-media">
                  {fijo.sucursal?.nombre ?? "General"}
                </Celda>
                <Celda ocultaMovil className="whitespace-nowrap text-tinta-media">
                  {NOMBRE_MEDIO[fijo.medioPago]}
                </Celda>
                <Celda derecha className="cifras whitespace-nowrap">
                  {formatoMoneda(fijo.montoEstimado)}
                </Celda>
                <Celda>
                  {delMes ? (
                    <EtiquetaEstadoFijo estado={delMes.estado} />
                  ) : (
                    <Etiqueta>Inactivo</Etiqueta>
                  )}
                </Celda>
                <Celda derecha className="whitespace-nowrap">
                  <span className="inline-flex gap-1">
                    {delMes && delMes.estado !== "REGISTRADO" ? (
                      <Link href={enlaceRegistrarFijo(fijo.id)} className={clasesBoton("secundario", "sm")}>
                        Registrar
                      </Link>
                    ) : null}
                    <Link href={`/gastos/fijos/${fijo.id}`} className={clasesBoton("fantasma", "sm")}>
                      <Icono nombre="editar" tamano={15} />
                      Editar
                    </Link>
                  </span>
                </Celda>
              </Fila>
            );
          })}
        </Tabla>
      )}
    </section>
  );
}
