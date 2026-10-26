"use client";

import type { UnidadVenta } from "@prisma/client";
import { useRef, useState, useTransition, type ReactNode } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, Campo, CampoSelect, GrupoCampo } from "@/components/ui/campo";
import {
  AlertaFormulario,
  PieFormulario,
  SeccionFormulario,
  useFormulario,
} from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Segmentado } from "@/components/ui/segmentado";
import { UNIDAD_PESO } from "@/lib/config";
import { sufijoUnidad } from "@/lib/formato";
import { FORMULARIO_INICIAL, type EstadoFormulario } from "@/lib/formulario";

import { crearCategoriaRapida } from "../categorias/actions";

type Opcion = { id: number; nombre: string };

export type ProductoFormulario = {
  idInterno: number;
  codigoBarras: string;
  nombre: string;
  categoriaId: number | null;
  proveedorId: number | null;
  unidadVenta: UnidadVenta;
  precioMinorista: string;
  precioMayorista: string;
  /** `YYYY-MM-DD` o vacío. */
  fechaVencimiento: string;
  activo: boolean;
};

const UNIDADES: readonly { valor: UnidadVenta; label: string }[] = [
  { valor: "UNIDAD", label: "Por unidad" },
  { valor: "PESO", label: `Por peso (${UNIDAD_PESO})` },
  { valor: "PAQUETE", label: "Por paquete" },
];

export function FormularioProducto({
  accion,
  inicial,
  categorias,
  proveedores,
  esNuevo,
}: {
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
  inicial: ProductoFormulario;
  categorias: readonly Opcion[];
  proveedores: readonly Opcion[];
  esNuevo: boolean;
}) {
  const [estado, alEnviar, pendiente] = useFormulario(accion, FORMULARIO_INICIAL);
  const [unidad, setUnidad] = useState<UnidadVenta>(inicial.unidadVenta);
  const [activo, setActivo] = useState(inicial.activo ? "si" : "no");
  const [minorista, setMinorista] = useState(inicial.precioMinorista);
  const [mayorista, setMayorista] = useState(inicial.precioMayorista);
  const nombre = useRef<HTMLInputElement>(null);

  const { errores } = estado;
  const sufijo = sufijoUnidad(unidad);

  // No bloquea: puede haber ofertas puntuales, pero casi siempre es un error de tipeo.
  const mayoristaMasCaro =
    minorista !== "" && mayorista !== "" && Number(mayorista) > Number(minorista);

  return (
    <form onSubmit={alEnviar} noValidate className="max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        {estado.error ? (
          <div className="px-5 pt-5">
            <AlertaFormulario mensaje={estado.error} />
          </div>
        ) : null}

        <SeccionFormulario
          titulo="Identificación"
          descripcion="El ID interno es el que se tipea en caja. El código de barras es opcional: con el lector, escaneá directamente sobre el campo."
        >
          <Campo
            id="idInterno"
            name="idInterno"
            etiqueta="ID interno"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={inicial.idInterno}
            required
            error={errores.idInterno}
            className="cifras font-mono"
          />
          <Campo
            id="codigoBarras"
            name="codigoBarras"
            etiqueta="Código de barras"
            defaultValue={inicial.codigoBarras}
            placeholder="Opcional"
            autoComplete="off"
            error={errores.codigoBarras}
            className="cifras font-mono"
            onKeyDown={(evento) => {
              // El lector de código termina cada lectura con Enter: sin esto
              // el escaneo enviaría el formulario a medio completar.
              if (evento.key === "Enter") {
                evento.preventDefault();
                nombre.current?.focus();
              }
            }}
          />
          <div className="sm:col-span-2">
            <Campo
              ref={nombre}
              id="nombre"
              name="nombre"
              etiqueta="Nombre"
              defaultValue={inicial.nombre}
              placeholder="Ej. Tomate larga vida"
              maxLength={120}
              required
              autoFocus={esNuevo}
              error={errores.nombre}
            />
          </div>
        </SeccionFormulario>

        <SeccionFormulario titulo="Clasificación">
          <SelectorCategoria
            iniciales={categorias}
            inicial={inicial.categoriaId}
            error={errores.categoriaId}
          />
          <CampoSelect
            id="proveedorId"
            name="proveedorId"
            etiqueta="Proveedor habitual"
            defaultValue={inicial.proveedorId ?? ""}
            error={errores.proveedorId}
          >
            <option value="">Sin proveedor</option>
            {proveedores.map((proveedor) => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.nombre}
              </option>
            ))}
          </CampoSelect>
        </SeccionFormulario>

        <SeccionFormulario
          titulo="Venta y precios"
          descripcion="Los precios son por la unidad de venta elegida. El mayorista se aplica a clientes mayoristas."
        >
          <div className="sm:col-span-2">
            <GrupoCampo etiqueta="Unidad de venta" error={errores.unidadVenta}>
              <Segmentado
                etiqueta="Unidad de venta"
                name="unidadVenta"
                valor={unidad}
                onCambio={setUnidad}
                opciones={UNIDADES}
              />
            </GrupoCampo>
          </div>
          <CampoPrecio
            id="precioMinorista"
            etiqueta={`Precio minorista por ${sufijo}`}
            valor={minorista}
            onCambio={setMinorista}
            error={errores.precioMinorista}
          />
          <CampoPrecio
            id="precioMayorista"
            etiqueta={`Precio mayorista por ${sufijo}`}
            valor={mayorista}
            onCambio={setMayorista}
            error={errores.precioMayorista}
            ayuda={
              mayoristaMasCaro ? (
                <span className="text-alerta-tinta">
                  Ojo: el mayorista quedó más caro que el minorista.
                </span>
              ) : undefined
            }
          />
        </SeccionFormulario>

        <SeccionFormulario titulo={esNuevo ? "Vencimiento" : "Vencimiento y estado"}>
          <Campo
            id="fechaVencimiento"
            name="fechaVencimiento"
            etiqueta="Fecha de vencimiento"
            type="date"
            defaultValue={inicial.fechaVencimiento}
            error={errores.fechaVencimiento}
            ayuda="Opcional. Para productos con fecha impresa."
          />
          {esNuevo ? null : (
            <GrupoCampo
              etiqueta="Estado"
              ayuda={
                activo === "si"
                  ? "Visible en caja."
                  : "No aparece en caja. Conserva su historial de ventas."
              }
            >
              <Segmentado
                etiqueta="Estado del producto"
                name="activo"
                valor={activo}
                onCambio={setActivo}
                opciones={[
                  { valor: "si", label: "Activo" },
                  { valor: "no", label: "Inactivo" },
                ]}
              />
            </GrupoCampo>
          )}
        </SeccionFormulario>

        <PieFormulario
          volverA="/productos"
          pendiente={pendiente}
          textoEnviar={esNuevo ? "Crear producto" : "Guardar cambios"}
        />
      </div>
    </form>
  );
}

function CampoPrecio({
  id,
  etiqueta,
  valor,
  onCambio,
  error,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  error?: string;
  ayuda?: ReactNode;
}) {
  return (
    <GrupoCampo etiqueta={etiqueta} htmlFor={id} error={error} ayuda={ayuda}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tinta-suave">
          L
        </span>
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          value={valor}
          onChange={(evento) => onCambio(evento.target.value)}
          required
          aria-invalid={error ? true : undefined}
          className={`cifras h-10 pl-7 ${CLASES_INPUT}`}
        />
      </div>
    </GrupoCampo>
  );
}

/**
 * Select de categoría con alta al vuelo: si la categoría no existe, se crea
 * acá mismo y queda elegida, sin perder lo cargado en el resto del producto.
 */
function SelectorCategoria({
  iniciales,
  inicial,
  error,
}: {
  iniciales: readonly Opcion[];
  inicial: number | null;
  error?: string;
}) {
  const [opciones, setOpciones] = useState(iniciales);
  const [seleccion, setSeleccion] = useState(inicial === null ? "" : String(inicial));
  const [creando, setCreando] = useState(iniciales.length === 0);
  const [nueva, setNueva] = useState("");
  const [errorNueva, setErrorNueva] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function crear() {
    startTransition(async () => {
      const resultado = await crearCategoriaRapida(nueva);
      if (!resultado.ok) {
        setErrorNueva(resultado.error);
        return;
      }
      const { categoria } = resultado;
      setOpciones((previas) =>
        [...previas, categoria].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      );
      setSeleccion(String(categoria.id));
      setNueva("");
      setErrorNueva(null);
      setCreando(false);
    });
  }

  if (creando) {
    return (
      <GrupoCampo
        etiqueta="Nueva categoría"
        htmlFor="categoriaNueva"
        error={errorNueva ?? error}
        ayuda="Se crea al confirmar y queda elegida para este producto."
      >
        {/* El valor elegido sigue viajando con el formulario mientras se crea la nueva. */}
        <input type="hidden" name="categoriaId" value={seleccion} />
        <div className="flex gap-2">
          <input
            id="categoriaNueva"
            value={nueva}
            onChange={(evento) => setNueva(evento.target.value)}
            onKeyDown={(evento) => {
              // Enter crea la categoría en vez de enviar el producto.
              if (evento.key === "Enter") {
                evento.preventDefault();
                crear();
              }
              if (evento.key === "Escape" && opciones.length > 0) setCreando(false);
            }}
            placeholder="Ej. Lácteos"
            maxLength={60}
            autoFocus
            aria-invalid={errorNueva ? true : undefined}
            className={`h-10 ${CLASES_INPUT}`}
          />
          <Boton
            variante="primario"
            className="h-10"
            disabled={pendiente || !nueva.trim()}
            onClick={crear}
          >
            {pendiente ? "Creando…" : "Crear"}
          </Boton>
          {opciones.length > 0 ? (
            <Boton variante="fantasma" className="h-10" onClick={() => setCreando(false)}>
              Cancelar
            </Boton>
          ) : null}
        </div>
      </GrupoCampo>
    );
  }

  return (
    <GrupoCampo etiqueta="Categoría" htmlFor="categoriaId" error={error}>
      <div className="flex gap-2">
        <select
          id="categoriaId"
          name="categoriaId"
          value={seleccion}
          onChange={(evento) => setSeleccion(evento.target.value)}
          required
          aria-invalid={error ? true : undefined}
          className={`select-nativo h-10 pr-9 ${CLASES_INPUT}`}
        >
          <option value="" disabled>
            Elegí una categoría
          </option>
          {opciones.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
        <Boton
          className="h-10 shrink-0"
          onClick={() => setCreando(true)}
          title="Crear una categoría nueva"
        >
          <Icono nombre="mas" tamano={16} />
          Nueva
        </Boton>
      </div>
    </GrupoCampo>
  );
}
