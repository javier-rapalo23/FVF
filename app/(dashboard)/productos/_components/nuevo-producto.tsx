"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Icono } from "@/components/ui/icono";

import { crearProductoDesdeDialogo } from "../actions";
import { FormularioProducto } from "./formulario-producto";

type Opcion = { id: number; nombre: string };

/**
 * Botón "Nuevo producto" que abre el alta en un diálogo, sin salir del
 * listado. Al guardar cierra y muestra el aviso de guardado del listado.
 */
export function NuevoProducto({
  siguienteIdInterno,
  categorias,
  proveedores,
  texto = "Nuevo producto",
}: {
  /** ID interno propuesto: correlativo al último cargado. */
  siguienteIdInterno: number;
  categorias: readonly Opcion[];
  proveedores: readonly Opcion[];
  texto?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const cerrar = useCallback(() => setAbierto(false), []);

  const alGuardar = useCallback(
    (nombre: string) => {
      setAbierto(false);
      router.replace(`/productos?guardado=${encodeURIComponent(nombre)}`, { scroll: false });
    },
    [router],
  );

  return (
    <>
      <Boton variante="primario" onClick={() => setAbierto(true)}>
        <Icono nombre="mas" tamano={16} />
        {texto}
      </Boton>

      <Dialogo abierto={abierto} onCerrar={cerrar} titulo="Nuevo producto" ancho="xl">
        <FormularioProducto
          accion={crearProductoDesdeDialogo}
          esNuevo
          dialogo={{ onCancelar: cerrar, onGuardado: alGuardar }}
          categorias={categorias}
          proveedores={proveedores}
          inicial={{
            idInterno: siguienteIdInterno,
            codigoBarras: "",
            nombre: "",
            categoriaId: null,
            proveedorId: null,
            unidadVenta: "UNIDAD",
            precioMinorista: "",
            precioMayorista: "",
            fechaVencimiento: "",
            stockMinimo: "",
            observaciones: "",
            activo: true,
          }}
        />
      </Dialogo>
    </>
  );
}
