"use server";

import { revalidatePath } from "next/cache";

import { exigirAdministrador } from "@/lib/acceso";
import { campoDuplicado, type EstadoFormulario } from "@/lib/formulario";
import { prisma } from "@/lib/prisma";

const MAX_NOMBRE = 60;

type Resultado =
  | { ok: true; categoria: { id: number; nombre: string } }
  | { ok: false; error: string };

/**
 * Núcleo compartido por el alta desde la pantalla de categorías y el alta al
 * vuelo desde el formulario de producto. La unicidad se compara sin distinguir
 * mayúsculas: "verduras" y "Verduras" serían la misma categoría para el local.
 */
async function guardarCategoria(id: number | null, nombre: string): Promise<Resultado> {
  if (!nombre) return { ok: false, error: "Escribí un nombre." };
  if (nombre.length > MAX_NOMBRE) {
    return { ok: false, error: `Máximo ${MAX_NOMBRE} caracteres.` };
  }

  const existente = await prisma.categoria.findFirst({
    where: {
      nombre: { equals: nombre, mode: "insensitive" },
      ...(id === null ? {} : { NOT: { id } }),
    },
    select: { nombre: true },
  });
  if (existente) {
    return { ok: false, error: `Ya existe la categoría «${existente.nombre}».` };
  }

  try {
    const categoria =
      id === null
        ? await prisma.categoria.create({ data: { nombre }, select: { id: true, nombre: true } })
        : await prisma.categoria.update({
            where: { id },
            data: { nombre },
            select: { id: true, nombre: true },
          });

    revalidatePath("/productos", "layout");
    revalidatePath("/caja");
    return { ok: true, categoria };
  } catch (error) {
    if (campoDuplicado(error, ["nombre"])) {
      return { ok: false, error: "Ya existe una categoría con ese nombre." };
    }
    throw error;
  }
}

function normalizar(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
}

/** Alta al vuelo desde el formulario de producto, sin salir de la pantalla. */
export async function crearCategoriaRapida(nombre: string): Promise<Resultado> {
  await exigirAdministrador();
  return guardarCategoria(null, normalizar(nombre));
}

export async function crearCategoria(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministrador();

  const resultado = await guardarCategoria(null, normalizar(datos.get("nombre")));
  return resultado.ok
    ? { error: null, errores: {}, exito: `Categoría «${resultado.categoria.nombre}» creada.` }
    : { error: null, errores: { nombre: resultado.error } };
}

export async function renombrarCategoria(
  id: number,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministrador();

  const resultado = await guardarCategoria(id, normalizar(datos.get("nombre")));
  return resultado.ok
    ? { error: null, errores: {}, exito: "Guardado." }
    : { error: null, errores: { nombre: resultado.error } };
}

/**
 * Solo se elimina una categoría vacía: los productos exigen categoría y una
 * vez vendidos no se borran. Sirve para deshacer una categoría creada por error.
 */
export async function eliminarCategoria(id: number): Promise<{ error: string | null }> {
  await exigirAdministrador();

  const enUso = await prisma.producto.count({ where: { categoriaId: id } });
  if (enUso > 0) {
    return {
      error: `No se puede eliminar: tiene ${enUso} ${enUso === 1 ? "producto" : "productos"}.`,
    };
  }

  await prisma.categoria.deleteMany({ where: { id } });
  revalidatePath("/productos", "layout");
  return { error: null };
}
