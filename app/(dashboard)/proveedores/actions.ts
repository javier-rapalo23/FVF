"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirAdministrador } from "@/lib/acceso";
import { esRelacionInvalida, leerFormulario, type EstadoFormulario } from "@/lib/formulario";
import { prisma } from "@/lib/prisma";

/** Alta (`id` null) o edición de un proveedor. Se usa enlazada con `.bind`. */
export async function guardarProveedor(
  id: number | null,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministrador();

  const f = leerFormulario(datos);
  const proveedor = {
    nombre: f.texto("nombre"),
    telefono: f.textoOpcional("telefono", { max: 30 }),
    rtn: f.rtn("rtn"),
    correo: f.correo("correo"),
    direccion: f.textoOpcional("direccion", { max: 250 }),
    observaciones: f.textoLargo("observaciones"),
    // Un proveedor nuevo siempre nace activo; el interruptor solo existe al editar.
    activo: id === null ? true : f.booleano("activo"),
  };

  if (!f.valido) return f.estado();

  if (proveedor.rtn) {
    const mismoRtn = await prisma.proveedor.findFirst({
      where: { rtn: proveedor.rtn, ...(id === null ? {} : { NOT: { id } }) },
      select: { nombre: true },
    });
    if (mismoRtn) {
      f.fallar("rtn", `Ya lo tiene el proveedor «${mismoRtn.nombre}».`);
      return f.estado();
    }
  }

  // El schema no lo exige, pero dos fichas del mismo proveedor partirían en
  // dos su cuenta por pagar: se frena el duplicado obvio.
  const repetido = await prisma.proveedor.findFirst({
    where: {
      nombre: { equals: proveedor.nombre, mode: "insensitive" },
      ...(id === null ? {} : { NOT: { id } }),
    },
    select: { nombre: true },
  });
  if (repetido) {
    f.fallar("nombre", `Ya existe el proveedor «${repetido.nombre}».`);
    return f.estado();
  }

  try {
    if (id === null) {
      await prisma.proveedor.create({ data: proveedor });
    } else {
      await prisma.proveedor.update({ where: { id }, data: proveedor });
    }
  } catch (error) {
    if (esRelacionInvalida(error)) {
      return f.estado("El proveedor ya no existe. Recargá la página.");
    }
    throw error;
  }

  revalidatePath("/proveedores", "layout");
  revalidatePath("/productos", "layout");
  const aviso = `guardado=${encodeURIComponent(proveedor.nombre)}`;
  // Al editar se vuelve a la ficha, que es desde donde se llegó al formulario.
  redirect(id === null ? `/proveedores?${aviso}` : `/proveedores/${id}?${aviso}`);
}
