import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BarraFiltros } from "@/components/ui/filtros";
import { Icono } from "@/components/ui/icono";
import { EncabezadoPagina, EstadoVacio, Tarjeta } from "@/components/ui/pagina";
import { SelectorSucursal } from "@/components/ui/selector-sucursal";
import { requerirUsuarioActivo } from "@/lib/acceso";
import { textoMonto } from "@/lib/calculos";
import { formatoMoneda } from "@/lib/formato";
import {
  cumpleFiltro,
  esFiltroInventario,
  FILTROS_INVENTARIO,
  inventarioDeSucursal,
  valorTotal,
  type FiltroInventario,
} from "@/lib/inventario/listado";
import { leerParametros, type ParametrosBusqueda } from "@/lib/listados";
import { sucursalDePantalla } from "@/lib/sucursal";
import { normalizarTexto } from "@/lib/texto";

import { TablaInventario } from "./_components/tabla-inventario";

export const metadata: Metadata = {
  title: "Inventario | Inversiones Ferrera",
};

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuarioActivo();
  if (!usuario) redirect("/api/sesion/cerrar");

  const parametros = await leerParametros(searchParams);
  const contexto = await sucursalDePantalla(usuario, parametros.sucursal);

  if (!contexto) {
    return (
      <section>
        <EncabezadoPagina titulo="Inventario" />
        <EstadoVacio icono="inventario" titulo="No hay sucursales cargadas">
          El inventario se lleva por sucursal: hace falta al menos una.
        </EstadoVacio>
      </section>
    );
  }

  const { sucursal, opciones } = contexto;
  const filas = await inventarioDeSucursal(sucursal.id);

  const q = normalizarTexto(parametros.q ?? "");
  const categoria = parametros.categoria ?? "";
  const filtro: FiltroInventario = esFiltroInventario(parametros.filtro ?? "")
    ? (parametros.filtro as FiltroInventario)
    : "";

  // Búsqueda y categoría acotan el universo; los filtros rápidos (y sus
  // contadores) trabajan sobre ese universo.
  const base = filas.filter(
    (f) =>
      (!q ||
        normalizarTexto(f.nombre).includes(q) ||
        String(f.idInterno) === q) &&
      (!categoria || f.categoria === categoria),
  );
  const visibles = base.filter((f) => cumpleFiltro(f, filtro));
  const contadores = Object.fromEntries(
    FILTROS_INVENTARIO.map((f) => [f.valor, base.filter((fila) => cumpleFiltro(fila, f.valor)).length]),
  ) as Record<FiltroInventario, number>;

  const valorSucursal = valorTotal(filas);
  const sinCostoConStock = filas.filter(
    (f) => f.alertas.sinCosto && Number(f.stock) > 0,
  ).length;
  const avisosOffline = filas.filter((f) => f.avisoOffline);
  const categorias = [...new Set(filas.map((f) => f.categoria))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const consultaSucursal = opciones.length > 0 ? `?sucursal=${sucursal.id}` : "";

  function enlaceFiltro(valor: FiltroInventario): string {
    const p = new URLSearchParams();
    if (opciones.length > 0) p.set("sucursal", String(sucursal.id));
    if (parametros.q) p.set("q", parametros.q);
    if (categoria) p.set("categoria", categoria);
    if (valor) p.set("filtro", valor);
    const query = p.toString();
    return query ? `/inventario?${query}` : "/inventario";
  }

  return (
    <section>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Stock de la sucursal, valorizado al último costo. Los conteos fijan la cantidad real; las mermas descuentan lo que se pierde."
        acciones={
          opciones.length > 0 ? (
            <SelectorSucursal opciones={opciones} actual={sucursal.id} />
          ) : null
        }
      />

      {filas.length === 0 ? (
        <EstadoVacio icono="productos" titulo="Todavía no hay productos">
          Cargá productos para empezar a llevar el inventario.
        </EstadoVacio>
      ) : (
        <>
          <Tarjeta className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Inventario valorizado · {sucursal.nombre}
              </p>
              <p className="cifras text-[24px] font-semibold tracking-[-0.02em] text-tinta">
                {formatoMoneda(valorSucursal)}
              </p>
            </div>
            <p className="max-w-md text-[12px] leading-relaxed text-tinta-suave">
              Stock positivo × último costo de compra.
              {sinCostoConStock > 0
                ? ` ${sinCostoConStock} ${sinCostoConStock === 1 ? "producto con stock no tiene" : "productos con stock no tienen"} costo y no suman.`
                : ""}
            </p>
          </Tarjeta>

          {avisosOffline.length > 0 ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-info-fondo px-3.5 py-2.5 text-[13px] leading-snug text-info-tinta">
              <span className="mt-px shrink-0">
                <Icono nombre="alerta" tamano={15} />
              </span>
              <p>
                Se sincronizaron ventas sin conexión cobradas antes del último conteo de{" "}
                <span className="font-medium">
                  {avisosOffline
                    .slice(0, 5)
                    .map((f) => f.nombre)
                    .join(", ")}
                  {avisosOffline.length > 5 ? ` y ${avisosOffline.length - 5} más` : ""}
                </span>
                . Esas ventas descontaron stock que el conteo ya reflejaba: conviene volver a
                contarlos.
              </p>
            </div>
          ) : null}

          <nav aria-label="Filtros rápidos" className="mb-3 flex flex-wrap gap-1.5">
            {FILTROS_INVENTARIO.map((f) => {
              const activo = f.valor === filtro;
              return (
                <Link
                  key={f.valor}
                  href={enlaceFiltro(f.valor)}
                  aria-current={activo ? "page" : undefined}
                  className={[
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors duration-150",
                    activo
                      ? "border-tinta bg-tinta text-superficie"
                      : "border-borde bg-superficie text-tinta-media hover:border-borde-fuerte hover:text-tinta",
                  ].join(" ")}
                >
                  {f.label}
                  <span className={`cifras text-[12px] ${activo ? "opacity-80" : "text-tinta-suave"}`}>
                    {contadores[f.valor]}
                  </span>
                </Link>
              );
            })}
          </nav>

          <BarraFiltros
            placeholder="Buscar por nombre o ID interno"
            valores={parametros}
            filtros={[
              {
                nombre: "categoria",
                etiqueta: "Categoría",
                opciones: [
                  { valor: "", label: "Todas las categorías" },
                  ...categorias.map((c) => ({ valor: c, label: c })),
                ],
              },
            ]}
          />

          {visibles.length === 0 ? (
            <EstadoVacio icono="buscar" titulo="Sin resultados">
              Ningún producto coincide con la búsqueda y el filtro elegidos.
            </EstadoVacio>
          ) : (
            <TablaInventario
              key={sucursal.id}
              filas={visibles}
              sucursalId={sucursal.id}
              usuarioId={usuario.id}
              consultaSucursal={consultaSucursal}
              totalVisible={textoMonto(valorTotal(visibles))}
            />
          )}
        </>
      )}
    </section>
  );
}
