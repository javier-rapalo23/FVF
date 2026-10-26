"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { Boton } from "@/components/ui/boton";
import { CLASES_INPUT } from "@/components/ui/campo";
import { useFormulario } from "@/components/ui/formulario";
import { Icono } from "@/components/ui/icono";
import { Celda, Fila } from "@/components/ui/tabla";
import { FORMULARIO_INICIAL } from "@/lib/formulario";

import { crearCategoria, eliminarCategoria, renombrarCategoria } from "../actions";

export function NuevaCategoria() {
  const [estado, alEnviar, pendiente] = useFormulario(crearCategoria, FORMULARIO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  // Tras un alta exitosa se limpia el campo para cargar la siguiente de corrido.
  useEffect(() => {
    if (estado.exito) formulario.current?.reset();
  }, [estado]);

  const error = estado.errores.nombre;

  return (
    <form ref={formulario} onSubmit={alEnviar} className="mb-4">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Nombre de la nueva categoría</span>
          <input
            name="nombre"
            placeholder="Nueva categoría, ej. Lácteos"
            maxLength={60}
            required
            aria-invalid={error ? true : undefined}
            className={`h-9 ${CLASES_INPUT}`}
          />
        </label>
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

export function FilaCategoria({
  id,
  nombre,
  productos,
}: {
  id: number;
  nombre: string;
  productos: number;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, alEnviar, guardando] = useFormulario(
    renombrarCategoria.bind(null, id),
    FORMULARIO_INICIAL,
  );
  const [eliminando, startEliminar] = useTransition();
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // Al guardar con éxito se vuelve al modo lectura.
  useEffect(() => {
    if (estado.exito) setEditando(false);
  }, [estado]);

  function eliminar() {
    if (!window.confirm(`¿Eliminar la categoría «${nombre}»?`)) return;
    startEliminar(async () => {
      const resultado = await eliminarCategoria(id);
      setErrorEliminar(resultado.error);
    });
  }

  const error = estado.errores.nombre ?? errorEliminar;

  return (
    <Fila>
      <Celda>
        {editando ? (
          <form onSubmit={alEnviar} className="flex items-center gap-2">
            <input
              name="nombre"
              defaultValue={nombre}
              maxLength={60}
              required
              autoFocus
              aria-label={`Nuevo nombre para ${nombre}`}
              aria-invalid={error ? true : undefined}
              onKeyDown={(evento) => {
                if (evento.key === "Escape") setEditando(false);
              }}
              className={`h-8 max-w-xs ${CLASES_INPUT}`}
            />
            <Boton type="submit" tamano="sm" variante="primario" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
            <Boton tamano="sm" variante="fantasma" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
          </form>
        ) : (
          <span className="font-medium">{nombre}</span>
        )}
        {error ? <p className="mt-1 text-xs text-peligro-tinta">{error}</p> : null}
      </Celda>

      <Celda derecha className="cifras">
        {productos > 0 ? (
          <Link
            href={`/productos?categoria=${id}&estado=todos`}
            className="text-tinta-media underline-offset-2 hover:text-tinta hover:underline"
          >
            {productos}
          </Link>
        ) : (
          <span className="text-tinta-suave">0</span>
        )}
      </Celda>

      <Celda derecha>
        {editando ? null : (
          <span className="inline-flex gap-1">
            <Boton tamano="sm" variante="fantasma" onClick={() => setEditando(true)}>
              Renombrar
            </Boton>
            <button
              type="button"
              disabled={productos > 0 || eliminando}
              onClick={eliminar}
              title={
                productos > 0
                  ? "Solo se pueden eliminar categorías sin productos"
                  : `Eliminar ${nombre}`
              }
              className="flex h-8 w-8 items-center justify-center rounded-md text-tinta-suave transition-colors duration-150 hover:bg-peligro-fondo hover:text-peligro-tinta disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-tinta-suave"
            >
              <Icono nombre="basura" tamano={15} />
              <span className="sr-only">Eliminar {nombre}</span>
            </button>
          </span>
        )}
      </Celda>
    </Fila>
  );
}
