import type { CategoriaGasto } from "@prisma/client";

import { campoDuplicado } from "@/lib/formulario";
import { prisma } from "@/lib/prisma";

import { ErrorGasto, MAXIMO_NOMBRE_CONCEPTO } from "./tipos";

export type DatosConcepto = { nombre: string; categoria: CategoriaGasto; activo: boolean };

/**
 * Alta (`id` null) o edición de un concepto de gasto. El nombre es único sin
 * distinguir mayúsculas. Un concepto no se borra: se desactiva y conserva sus
 * gastos. Cambiar la categoría reclasifica también los gastos pasados.
 */
export async function guardarConcepto(id: number | null, datos: DatosConcepto): Promise<void> {
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  if (!nombre) throw new ErrorGasto("CONCEPTO_DUPLICADO", "Escribí un nombre.", "nombre");
  if (nombre.length > MAXIMO_NOMBRE_CONCEPTO) {
    throw new ErrorGasto("CONCEPTO_DUPLICADO", `Máximo ${MAXIMO_NOMBRE_CONCEPTO} caracteres.`, "nombre");
  }

  const repetido = await prisma.conceptoGasto.findFirst({
    where: {
      nombre: { equals: nombre, mode: "insensitive" },
      ...(id === null ? {} : { NOT: { id } }),
    },
    select: { nombre: true },
  });
  if (repetido) {
    throw new ErrorGasto("CONCEPTO_DUPLICADO", `Ya existe el concepto «${repetido.nombre}».`, "nombre");
  }

  const data = { nombre, categoria: datos.categoria, activo: id === null ? true : datos.activo };
  try {
    if (id === null) await prisma.conceptoGasto.create({ data });
    else await prisma.conceptoGasto.update({ where: { id }, data });
  } catch (error) {
    if (campoDuplicado(error, ["nombre"])) {
      throw new ErrorGasto("CONCEPTO_DUPLICADO", "Ya existe un concepto con ese nombre.", "nombre");
    }
    throw error;
  }
}
