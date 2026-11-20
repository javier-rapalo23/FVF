"use client";

import type { CategoriaGasto } from "@prisma/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT, CLASES_SELECT_SUELTO } from "@/components/ui/campo";
import { Etiqueta } from "@/components/ui/etiqueta";
import { useFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Celda, Fila } from "@/components/ui/tabla";
import { FORMULARIO_INICIAL } from "@/lib/formulario";
import { CATEGORIAS_GASTO, MAXIMO_NOMBRE_CONCEPTO, NOMBRE_CATEGORIA } from "@/lib/gastos/tipos";

import { crearConceptoAccion, editarConceptoAccion } from "../../actions";

function SelectorCategoria({
  valor,
  onCambio,
  etiqueta,
}: {
  valor: CategoriaGasto;
  onCambio?: (valor: CategoriaGasto) => void;
  etiqueta: string;
}) {
  return (
    <select
      name="categoria"
      aria-label={etiqueta}
      defaultValue={onCambio ? undefined : valor}
      value={onCambio ? valor : undefined}
      onChange={onCambio ? (evento) => onCambio(evento.target.value as CategoriaGasto) : undefined}
      className={`h-9 w-auto text-[13px] ${CLASES_SELECT_SUELTO}`}
    >
      {CATEGORIAS_GASTO.map((c) => (
        <option key={c} value={c}>
          {NOMBRE_CATEGORIA[c]}
        </option>
      ))}
    </select>
  );
}

export function NuevoConcepto() {
  const [estado, alEnviar, pendiente] = useFormulario(crearConceptoAccion, FORMULARIO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  // Tras un alta exitosa se limpia el campo para cargar el siguiente de corrido.
  useEffect(() => {
    if (estado.exito) formulario.current?.reset();
  }, [estado]);

  const error = estado.errores.nombre ?? estado.errores.categoria ?? estado.error;

  return (
    <form ref={formulario} onSubmit={alEnviar} className="mb-4">
      <div className="flex flex-wrap gap-2">
        <label className="min-w-[200px] flex-1">
          <span className="sr-only">Nombre del nuevo concepto</span>
          <input
            name="nombre"
            placeholder="Nuevo concepto, ej. Seguridad"
            maxLength={MAXIMO_NOMBRE_CONCEPTO}
            required
            aria-invalid={estado.errores.nombre ? true : undefined}
            className={`h-9 ${CLASES_INPUT}`}
          />
        </label>
        <SelectorCategoria valor="OPERATIVO" etiqueta="Categoría del nuevo concepto" />
        <Boton type="submit" variante="primario" disabled={pendiente}>
          <Icono nombre="mas" tamano={16} />
          {pendiente ? "Creando…" : "Crear"}
        </Boton>
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-peligro-tinta">{error}</p>
      ) : estado.exito ? (
        <p role="status" className="mt-1.5 text-xs text-exito-tinta">
          {estado.exito}
        </p>
      ) : null}
    </form>
  );
}

export function FilaConcepto({
  id,
  nombre,
  categoria,
  activo,
  gastos,
}: {
  id: number;
  nombre: string;
  categoria: CategoriaGasto;
  activo: boolean;
  gastos: number;
}) {
  const [editando, setEditando] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState(categoria);
  const [estado, alEnviar, guardando] = useFormulario(
    editarConceptoAccion.bind(null, id),
    FORMULARIO_INICIAL,
  );

  // Al guardar con éxito se vuelve al modo lectura.
  useEffect(() => {
    if (estado.exito) setEditando(false);
  }, [estado]);

  function empezar() {
    setNuevaCategoria(categoria);
    setEditando(true);
  }

  const error = estado.errores.nombre ?? estado.errores.categoria ?? estado.error;
  const reclasifica = editando && gastos > 0 && nuevaCategoria !== categoria;

  if (editando) {
    return (
      <Fila>
        <Celda colSpan={4}>
          <form onSubmit={alEnviar} className="flex flex-wrap items-center gap-2">
            <input
              name="nombre"
              defaultValue={nombre}
              maxLength={MAXIMO_NOMBRE_CONCEPTO}
              required
              autoFocus
              aria-label={`Nuevo nombre para ${nombre}`}
              aria-invalid={estado.errores.nombre ? true : undefined}
              onKeyDown={(evento) => {
                if (evento.key === "Escape") setEditando(false);
              }}
              className={`h-9 min-w-[180px] max-w-xs flex-1 ${CLASES_INPUT}`}
            />
            <SelectorCategoria
              valor={nuevaCategoria}
              onCambio={setNuevaCategoria}
              etiqueta={`Categoría de ${nombre}`}
            />
            <label className="flex h-9 items-center gap-2 px-1 text-[13px] text-tinta-media">
              <input
                type="checkbox"
                name="activo"
                value="si"
                defaultChecked={activo}
                className="h-4 w-4 accent-marca-600"
              />
              Activo
            </label>
            <Boton type="submit" tamano="sm" variante="primario" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
            <Boton tamano="sm" variante="fantasma" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
          </form>
          {reclasifica ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-alerta-tinta">
              <Icono nombre="alerta" tamano={13} />
              Sus {gastos} {gastos === 1 ? "gasto pasa" : "gastos pasan"} también a{" "}
              {NOMBRE_CATEGORIA[nuevaCategoria]}, incluidos los de meses anteriores.
            </p>
          ) : null}
          {error ? <p className="mt-1 text-xs text-peligro-tinta">{error}</p> : null}
        </Celda>
      </Fila>
    );
  }

  return (
    <Fila atenuada={!activo}>
      <Celda>
        <span className="font-medium">{nombre}</span>
        {activo ? null : <Etiqueta className="ml-2">Inactivo</Etiqueta>}
      </Celda>
      <Celda className="text-tinta-media">{NOMBRE_CATEGORIA[categoria]}</Celda>
      <Celda derecha className="cifras">
        {gastos > 0 ? (
          <Link
            href={`/gastos?concepto=${id}&desde=2000-01-01&anulados=1`}
            className="text-tinta-media underline-offset-2 hover:text-tinta hover:underline"
          >
            {gastos}
          </Link>
        ) : (
          <span className="text-tinta-suave">0</span>
        )}
      </Celda>
      <Celda derecha>
        <Boton tamano="sm" variante="fantasma" onClick={empezar}>
          <Icono nombre="editar" tamano={15} />
          Editar
        </Boton>
      </Celda>
    </Fila>
  );
}
