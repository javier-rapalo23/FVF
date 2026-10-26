import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Etiqueta, Tecla } from "@/components/ui/etiqueta";
import { Icono, type NombreIcono } from "@/components/ui/icono";
import { Marca } from "@/components/ui/marca";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/pagina";
import { cantidad, formatoMoneda } from "@/lib/formato";

import { DemoSegmentado } from "./_components/demo-segmentado";

export const metadata: Metadata = {
  title: "Referencia de diseño | Inversiones Ferrera",
};

/* -------------------------------------------------------------------------- */

/*
 * Las clases se escriben completas y nunca interpoladas (`bg-${x}`): Tailwind
 * extrae los nombres de forma estática del código y una clase armada en
 * tiempo de ejecución no llega a generarse.
 */
const MONOCROMO = [
  ["bg-lienzo", "lienzo", "#F7F6F3", "Fondo de la aplicación"],
  ["bg-superficie", "superficie", "#FFFFFF", "Tarjetas, barras, paneles"],
  ["bg-superficie-suave", "superficie-suave", "#FBFBFA", "Hover, campos deshabilitados"],
  ["bg-carbon", "carbon", "#1F1E1C", "Paneles oscuros y marca"],
  ["bg-carbon-suave", "carbon-suave", "#33312D", "Segundo plano sobre carbón"],
  ["bg-borde", "borde", "#E6E4DF", "Todo borde y divisor"],
  ["bg-borde-fuerte", "borde-fuerte", "#D4D1C9", "Borde en hover"],
  ["bg-tinta", "tinta", "#1F1E1C", "Texto principal"],
  ["bg-tinta-media", "tinta-media", "#6F6C66", "Texto secundario"],
  ["bg-tinta-suave", "tinta-suave", "#9A968E", "Meta, placeholders, iconos"],
] as const;

const MARCA = [
  ["bg-marca-50", "50", "#EFF6F0"],
  ["bg-marca-100", "100", "#D9EADD"],
  ["bg-marca-200", "200", "#B5D6BC"],
  ["bg-marca-300", "300", "#86BC93"],
  ["bg-marca-400", "400", "#55A068"],
  ["bg-marca-500", "500", "#2E8447"],
  ["bg-marca-600", "600", "#216B38"],
  ["bg-marca-700", "700", "#19532B"],
  ["bg-marca-800", "800", "#133F21"],
  ["bg-marca-900", "900", "#0E2D18"],
] as const;

const SEMANTICOS = [
  ["exito", "bg-exito-fondo", "text-exito-tinta", "Confirmaciones, producto ya en el ticket"],
  ["alerta", "bg-alerta-fondo", "text-alerta-tinta", "Stock excedido, borrador, fiado"],
  ["peligro", "bg-peligro-fondo", "text-peligro-tinta", "Errores, quitar, sin stock"],
  ["info", "bg-info-fondo", "text-info-tinta", "Avisos neutros"],
] as const;

const TIPOGRAFIA = [
  ["28px · semibold · tabular", "Total de la caja", "text-[28px] font-semibold tracking-[-0.02em] cifras"],
  ["22px · semibold", "Título de página", "text-[22px] font-semibold tracking-[-0.02em]"],
  ["15px · semibold", "Título de panel", "text-[15px] font-semibold tracking-[-0.01em]"],
  ["14px · medium", "Nombre de producto", "text-[14px] font-medium"],
  ["13px · regular", "Cuerpo de interfaz", "text-[13px]"],
  ["12px · regular", "Controles y chips", "text-[12px]"],
  ["11px · regular", "Meta y notas", "text-[11px] text-tinta-media"],
  ["10px · semibold · 0.08em", "Rótulo de sección", "text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave"],
] as const;

const ICONOS: readonly NombreIcono[] = [
  "caja", "cierres", "productos", "clientes", "proveedores", "compras",
  "gastos", "reportes", "usuarios", "tienda", "buscar", "mas", "menos",
  "basura", "salir", "check", "alerta", "chevron", "reloj",
];

const REGLAS = [
  [
    true,
    "El verde aparece solo en la acción primaria y en el módulo activo del menú.",
  ],
  [
    true,
    "Todo borde y divisor usa borde a 1px. Nunca 2px ni un gris más oscuro.",
  ],
  [
    true,
    "Todo importe o cantidad lleva la clase cifras para alinear los dígitos en columna.",
  ],
  [
    true,
    "El radio máximo en contenedores es xl (12px); los botones usan md (6px).",
  ],
  [
    false,
    "Sombras marcadas. Solo existen sutil y elevado, y ambas son casi imperceptibles.",
  ],
  [
    false,
    "Pastilla (rounded-full) en tarjetas o botones. Se reserva para badges de estado.",
  ],
  [
    false,
    "Bloques grandes de color de marca. El verde es acento, no superficie.",
  ],
  [
    false,
    "Texto en negro puro. El texto principal es tinta, un carbón cálido.",
  ],
] as const;

/* -------------------------------------------------------------------------- */

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-borde pt-8">
      <div className="mb-5 max-w-2xl">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tinta">
          {titulo}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-tinta-media">
          {descripcion}
        </p>
      </div>
      {children}
    </section>
  );
}

function Muestra({
  clase,
  nombre,
  hex,
  uso,
}: {
  clase: string;
  nombre: string;
  hex: string;
  uso?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`h-9 w-9 shrink-0 rounded-md border border-borde ${clase}`}
      />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12px] text-tinta">
          {nombre}
        </span>
        <span className="cifras block font-mono text-[11px] uppercase text-tinta-suave">
          {hex}
        </span>
        {uso ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-tinta-media">
            {uso}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Contenedor de demostración con el código de referencia al pie. */
function Demo({ children, nota }: { children: ReactNode; nota?: string }) {
  return (
    <Tarjeta className="overflow-hidden">
      <div className="p-5">{children}</div>
      {nota ? (
        <p className="border-t border-borde bg-superficie-suave px-5 py-2.5 font-mono text-[11px] text-tinta-suave">
          {nota}
        </p>
      ) : null}
    </Tarjeta>
  );
}

/* -------------------------------------------------------------------------- */

export default function EstiloPage() {
  // Referencia interna para construir los módulos que faltan: no se publica
  // junto al sistema en producción.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Marca />
        <Etiqueta tono="info">Solo desarrollo</Etiqueta>
      </div>

      <EncabezadoPagina
        titulo="Referencia de diseño"
        descripcion="Los tokens y componentes reales del sistema, renderizados desde el mismo código que usa la aplicación. Si algo cambia en globals.css o en components/ui, esta página lo refleja sola."
      />

      <div className="space-y-10">
        {/* ---------------------------------------------------------- Color */}
        <Seccion
          titulo="Color"
          descripcion="Monocromo cálido como base. El color se reserva para significado: verde para la acción, pasteles apagados para estados."
        >
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Monocromo
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MONOCROMO.map(([clase, nombre, hex, uso]) => (
                  <Muestra
                    key={nombre}
                    clase={clase}
                    nombre={nombre}
                    hex={hex}
                    uso={uso}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Verde de marca
              </p>
              <div className="flex flex-wrap gap-3">
                {MARCA.map(([clase, paso, hex]) => (
                  <div key={paso} className="w-[86px]">
                    <span
                      className={`block h-12 rounded-md border border-borde ${clase}`}
                    />
                    <span className="mt-1.5 block font-mono text-[11px] text-tinta">
                      {paso}
                    </span>
                    <span className="cifras block font-mono text-[10px] uppercase text-tinta-suave">
                      {hex}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-tinta-media">
                <span className="font-mono text-tinta">600</span> es el único
                tono que se usa como fondo (botón primario).{" "}
                <span className="font-mono text-tinta">500</span> tiñe iconos
                activos y el anillo de foco.
              </p>
            </div>

            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Estados
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SEMANTICOS.map(([nombre, claseFondo, claseTinta, uso]) => (
                  <div key={nombre} className={`rounded-lg px-4 py-3 ${claseFondo}`}>
                    <p className={`font-mono text-[12px] font-medium ${claseTinta}`}>
                      {nombre}-fondo / {nombre}-tinta
                    </p>
                    <p className={`mt-0.5 text-[11px] opacity-80 ${claseTinta}`}>
                      {uso}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Seccion>

        {/* ----------------------------------------------------- Tipografía */}
        <Seccion
          titulo="Tipografía"
          descripcion="Geist para interfaz y Geist Mono para cifras, códigos y teclas. El contraste entre ambas sostiene la jerarquía, sin color decorativo."
        >
          <Demo nota="Toda cifra lleva la clase .cifras — font-variant-numeric: tabular-nums">
            <div className="space-y-4">
              {TIPOGRAFIA.map(([escala, uso, clase]) => (
                <div
                  key={escala}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-borde pb-3 last:border-0 last:pb-0"
                >
                  <span className={clase}>{uso}</span>
                  <span className="font-mono text-[11px] text-tinta-suave">
                    {escala}
                  </span>
                </div>
              ))}
            </div>
          </Demo>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Tarjeta className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Con cifras tabulares
              </p>
              <div className="cifras mt-2 space-y-0.5 text-right font-mono text-[13px] text-tinta">
                <p>{formatoMoneda(1890)}</p>
                <p>{formatoMoneda(11110)}</p>
                <p>{formatoMoneda(3769)}</p>
              </div>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Sin cifras tabulares
              </p>
              <div className="mt-2 space-y-0.5 text-right font-sans text-[13px] text-tinta">
                <p>{formatoMoneda(1890)}</p>
                <p>{formatoMoneda(11110)}</p>
                <p>{formatoMoneda(3769)}</p>
              </div>
            </Tarjeta>
          </div>
        </Seccion>

        {/* --------------------------------------------------------- Iconos */}
        <Seccion
          titulo="Iconos"
          descripcion="Set propio, trazo 1.75 sobre grilla de 24. Se dibujan a mano para que el peso sea idéntico en todos y para no sumar una dependencia."
        >
          <Demo nota={`<Icono nombre="productos" tamano={18} />`}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
              {ICONOS.map((nombre) => (
                <div
                  key={nombre}
                  className="flex flex-col items-center gap-2 rounded-md border border-borde bg-superficie-suave px-2 py-3"
                >
                  <span className="text-tinta">
                    <Icono nombre={nombre} tamano={20} />
                  </span>
                  <span className="truncate font-mono text-[10px] text-tinta-suave">
                    {nombre}
                  </span>
                </div>
              ))}
            </div>
          </Demo>
        </Seccion>

        {/* ---------------------------------------------------- Componentes */}
        <Seccion
          titulo="Componentes"
          descripcion="Las primitivas de components/ui. Todo módulo nuevo debería construirse con estas antes de escribir clases sueltas."
        >
          <div className="space-y-4">
            <Demo nota={`<Boton variante="primario" tamano="lg">Cobrar</Boton>`}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Botón · variantes
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Boton variante="primario">Primario</Boton>
                <Boton variante="secundario">Secundario</Boton>
                <Boton variante="fantasma">Fantasma</Boton>
                <Boton variante="peligro">Peligro</Boton>
                <Boton variante="primario" disabled>
                  Deshabilitado
                </Boton>
              </div>

              <p className="mb-3 mt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Botón · tamaños
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Boton tamano="sm">Pequeño</Boton>
                <Boton tamano="md">Mediano</Boton>
                <Boton tamano="lg">Grande</Boton>
              </div>
            </Demo>

            <Demo nota={`<Etiqueta tono="alerta">Borrador</Etiqueta>  ·  <Tecla>F12</Tecla>`}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Etiquetas de estado
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta>Neutro</Etiqueta>
                <Etiqueta tono="exito">En ticket</Etiqueta>
                <Etiqueta tono="alerta">Borrador</Etiqueta>
                <Etiqueta tono="peligro">Sin stock</Etiqueta>
                <Etiqueta tono="info">Solo desarrollo</Etiqueta>
              </div>

              <p className="mb-3 mt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Teclas
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-tinta-media">
                <Tecla>/</Tecla>
                <Tecla>F12</Tecla>
                <Tecla>Esc</Tecla>
                <span>— la caja se opera sin soltar el teclado.</span>
              </div>
            </Demo>

            <Demo nota={`<Campo id="email" etiqueta="Email" ayuda="…" />`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  id="demo-campo"
                  etiqueta="Nombre del producto"
                  placeholder="Tomate"
                  ayuda="El texto de ayuda usa tinta-suave."
                />
                <Campo
                  id="demo-campo-off"
                  etiqueta="Campo deshabilitado"
                  placeholder="No editable"
                  disabled
                />
              </div>
            </Demo>

            <Demo nota={`<Segmentado valor={…} opciones={…} onCambio={…} />`}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                Control segmentado
              </p>
              <DemoSegmentado />
              <p className="mt-3 max-w-lg text-[12px] leading-relaxed text-tinta-media">
                Se prefiere a un <span className="font-mono">select</span> cuando
                hay dos o tres opciones: el estado queda visible sin abrir nada.
              </p>
            </Demo>
          </div>
        </Seccion>

        {/* ------------------------------------------------------- Formatos */}
        <Seccion
          titulo="Formato de cifras"
          descripcion="Vive en lib/formato.ts. El peso chileno no lleva decimales aunque el schema guarde Decimal(10,2), y la cantidad cambia de forma según la unidad de venta."
        >
          <Demo nota="formatoMoneda() · cantidad() · sufijoUnidad() · pasoUnidad()">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-borde text-[10px] font-semibold uppercase tracking-[0.08em] text-tinta-suave">
                  <th className="pb-2 font-semibold">Llamada</th>
                  <th className="pb-2 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="text-tinta">
                {[
                  ["formatoMoneda(1890)", formatoMoneda(1890)],
                  ["formatoMoneda('1690.00')", formatoMoneda("1690.00")],
                  ["cantidad(45.5, 'PESO')", cantidad(45.5, "PESO")],
                  ["cantidad(120, 'PAQUETE')", cantidad(120, "PAQUETE")],
                  ["cantidad(3, 'UNIDAD')", cantidad(3, "UNIDAD")],
                ].map(([llamada, resultado]) => (
                  <tr key={llamada} className="border-b border-borde last:border-0">
                    <td className="py-2 font-mono text-[12px] text-tinta-media">
                      {llamada}
                    </td>
                    <td className="cifras py-2 font-medium">{resultado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Demo>
        </Seccion>

        {/* --------------------------------------------------------- Reglas */}
        <Seccion
          titulo="Reglas"
          descripcion="Lo que mantiene el sistema coherente a medida que se suman módulos."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {REGLAS.map(([correcto, texto]) => (
              <div
                key={texto}
                className="flex items-start gap-2.5 rounded-lg border border-borde bg-superficie px-4 py-3"
              >
                <span
                  className={`mt-0.5 shrink-0 ${correcto ? "text-marca-600" : "text-peligro-tinta"}`}
                >
                  <Icono nombre={correcto ? "check" : "alerta"} tamano={15} />
                </span>
                <p className="text-[13px] leading-relaxed text-tinta-media">
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </Seccion>
      </div>

      <p className="mt-10 border-t border-borde pt-5 text-[12px] text-tinta-media">
        Tokens en{" "}
        <span className="font-mono text-tinta">app/globals.css</span> ·
        componentes en{" "}
        <span className="font-mono text-tinta">components/ui/</span> · formato en{" "}
        <span className="font-mono text-tinta">lib/formato.ts</span>
      </p>
    </div>
  );
}
