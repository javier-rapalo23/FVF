"use server";

import type { UnidadVenta } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirAdministrador } from "@/lib/acceso";
import {
  campoDuplicado,
  esRelacionInvalida,
  leerFormulario,
  type EstadoFormulario,
} from "@/lib/formulario";
import { prisma } from "@/lib/prisma";

const UNIDADES = ["PESO", "UNIDAD", "PAQUETE"] as const satisfies readonly UnidadVenta[];

/** Alta (`id` null) o edición de un producto. Se usa enlazada con `.bind`. */
export async function guardarProducto(
  id: number | null,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministrador();

  const f = leerFormulario(datos);
  const producto = {
    idInterno: f.entero("idInterno"),
    // Los lectores de código envían solo dígitos (EAN/UPC), pero hay códigos
    // internos de proveedor con letras: alcanza con exigir que no haya espacios.
    codigoBarras: f.textoOpcional("codigoBarras", {
      max: 64,
      patron: /^\S+$/,
      mensaje: "El código no puede tener espacios.",
    }),
    nombre: f.texto("nombre"),
    categoriaId: f.id("categoriaId", "Elegí una categoría."),
    proveedorId: f.idOpcional("proveedorId"),
    unidadVenta: f.opcion("unidadVenta", UNIDADES),
    precioMinorista: f.monto("precioMinorista"),
    precioMayorista: f.monto("precioMayorista"),
    fechaVencimiento: f.fechaOpcional("fechaVencimiento"),
    // Un producto nuevo siempre nace activo; el interruptor solo existe al editar.
    activo: id === null ? true : f.booleano("activo"),
  };

  if (!f.valido) return f.estado();

  const otro = id === null ? {} : { NOT: { id } };
  const [mismoIdInterno, mismoCodigo] = await Promise.all([
    prisma.producto.findFirst({
      where: { idInterno: producto.idInterno, ...otro },
      select: { nombre: true },
    }),
    producto.codigoBarras
      ? prisma.producto.findFirst({
          where: { codigoBarras: producto.codigoBarras, ...otro },
          select: { nombre: true },
        })
      : null,
  ]);

  if (mismoIdInterno) f.fallar("idInterno", `Ya lo usa «${mismoIdInterno.nombre}».`);
  if (mismoCodigo) f.fallar("codigoBarras", `Ya lo usa «${mismoCodigo.nombre}».`);
  if (!f.valido) return f.estado();

  try {
    if (id === null) {
      await prisma.producto.create({ data: producto });
    } else {
      await prisma.producto.update({ where: { id }, data: producto });
    }
  } catch (error) {
    const duplicado = campoDuplicado(error, ["idInterno", "codigoBarras"]);
    if (duplicado) {
      f.fallar(duplicado, "Otro producto ya usa este valor.");
      return f.estado();
    }
    if (esRelacionInvalida(error)) {
      return f.estado(
        "La categoría, el proveedor o el propio producto ya no existen. Recargá la página.",
      );
    }
    throw error;
  }

  revalidatePath("/productos");
  revalidatePath("/caja");
  redirect(`/productos?guardado=${encodeURIComponent(producto.nombre)}`);
}
