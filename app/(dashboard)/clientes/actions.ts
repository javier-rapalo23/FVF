"use server";

import type { TipoCliente } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirAdministrador } from "@/lib/acceso";
import { esRelacionInvalida, leerFormulario, type EstadoFormulario } from "@/lib/formulario";
import { prisma } from "@/lib/prisma";

const TIPOS = ["MINORISTA", "MAYORISTA"] as const satisfies readonly TipoCliente[];

/** Alta (`id` null) o edición de un cliente. Se usa enlazada con `.bind`. */
export async function guardarCliente(
  id: number | null,
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministrador();

  const f = leerFormulario(datos);
  const cliente = {
    nombre: f.texto("nombre"),
    telefono: f.textoOpcional("telefono", { max: 30 }),
    rtn: f.rtn("rtn"),
    correo: f.correo("correo"),
    direccion: f.textoOpcional("direccion", { max: 250 }),
    observaciones: f.textoLargo("observaciones"),
    tipo: f.opcion("tipo", TIPOS),
    fiadoHabilitado: f.booleano("fiadoHabilitado"),
    // Tope de deuda para el fiado. Vacío = sin tope. Se conserva aunque el
    // fiado se deshabilite, para no perderlo si se vuelve a habilitar.
    limiteCredito: f.monto("limiteCredito", { opcional: true }),
    activo: id === null ? true : f.booleano("activo"),
  };

  if (!f.valido) return f.estado();

  // Dos fichas con el mismo RTN partirían en dos la cuenta del cliente.
  if (cliente.rtn) {
    const mismoRtn = await prisma.cliente.findFirst({
      where: { rtn: cliente.rtn, ...(id === null ? {} : { NOT: { id } }) },
      select: { nombre: true },
    });
    if (mismoRtn) {
      f.fallar("rtn", `Ya lo tiene el cliente «${mismoRtn.nombre}».`);
      return f.estado();
    }
  }

  try {
    if (id === null) {
      await prisma.cliente.create({ data: cliente });
    } else {
      await prisma.cliente.update({ where: { id }, data: cliente });
    }
  } catch (error) {
    if (esRelacionInvalida(error)) {
      return f.estado("El cliente ya no existe. Recargá la página.");
    }
    throw error;
  }

  revalidatePath("/clientes", "layout");
  revalidatePath("/caja");
  const aviso = `guardado=${encodeURIComponent(cliente.nombre)}`;
  // Al editar se vuelve a la ficha, que es desde donde se llegó al formulario.
  redirect(id === null ? `/clientes?${aviso}` : `/clientes/${id}?${aviso}`);
}
