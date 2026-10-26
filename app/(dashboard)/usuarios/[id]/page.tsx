import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Etiqueta } from "@/components/ui/etiqueta";
import { EncabezadoPagina, Volver } from "@/components/ui/pagina";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { guardarUsuario } from "../actions";
import { FormularioUsuario } from "../_components/formulario-usuario";

export const metadata: Metadata = {
  title: "Editar usuario | Inversiones Ferrera",
};

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [usuario, sucursales, sesion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        sucursalId: true,
        activo: true,
      },
    }),
    prisma.sucursal.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    auth(),
  ]);
  if (!usuario) notFound();

  const esPropio = sesion?.user.id === String(usuario.id);

  return (
    <section>
      <Volver href="/usuarios">Usuarios</Volver>
      <EncabezadoPagina
        titulo={usuario.nombre}
        meta={
          esPropio ? (
            <Etiqueta tono="info">Tu usuario</Etiqueta>
          ) : usuario.activo ? null : (
            <Etiqueta>Inactivo</Etiqueta>
          )
        }
      />

      <FormularioUsuario
        accion={guardarUsuario.bind(null, usuario.id)}
        esNuevo={false}
        esPropio={esPropio}
        sucursales={sucursales}
        inicial={{
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          sucursalId: usuario.sucursalId,
          activo: usuario.activo,
        }}
      />
    </section>
  );
}
