import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";

import { clasesBoton } from "@/components/ui/boton";
import { Etiqueta } from "@/components/ui/etiqueta";
import { BarraFiltros } from "@/components/ui/filtros";
import { Icono } from "@/components/ui/icono";
import { AvisoGuardado, EncabezadoPagina, EstadoVacio } from "@/components/ui/pagina";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import { auth } from "@/lib/auth";
import {
  filtroActivo,
  leerParametros,
  OPCIONES_ESTADO,
  type ParametrosBusqueda,
} from "@/lib/listados";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Usuarios | Inversiones Ferrera",
};

const NOMBRE_ROL = {
  ADMINISTRADOR: "Administrador",
  EMPLEADO_CAJA: "Empleado de caja",
} as const;

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: ParametrosBusqueda;
}) {
  const parametros = await leerParametros(searchParams);
  const { q = "", rol = "", estado = "" } = parametros;

  const where: Prisma.UsuarioWhereInput = { ...filtroActivo(estado) };
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (rol === "ADMINISTRADOR" || rol === "EMPLEADO_CAJA") where.rol = rol;

  const [usuarios, sesion] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        sucursal: { select: { nombre: true } },
      },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    auth(),
  ]);

  return (
    <section>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Quién puede entrar al sistema, con qué rol y en qué sucursal."
        acciones={
          <Link href="/usuarios/nuevo" className={clasesBoton("primario")}>
            <Icono nombre="mas" tamano={16} />
            Nuevo usuario
          </Link>
        }
      />

      <AvisoGuardado nombre={parametros.guardado} />

      <BarraFiltros
        placeholder="Buscar por nombre o email"
        valores={parametros}
        filtros={[
          {
            nombre: "rol",
            etiqueta: "Rol",
            opciones: [
              { valor: "", label: "Todos los roles" },
              { valor: "ADMINISTRADOR", label: "Administradores" },
              { valor: "EMPLEADO_CAJA", label: "Empleados de caja" },
            ],
          },
          { nombre: "estado", etiqueta: "Estado", opciones: OPCIONES_ESTADO },
        ]}
      />

      {usuarios.length === 0 ? (
        <EstadoVacio icono="buscar" titulo="Sin resultados">
          Ningún usuario coincide con la búsqueda.
        </EstadoVacio>
      ) : (
        <Tabla
          columnas={[
            { label: "Usuario" },
            { label: "Rol" },
            { label: "Sucursal", ocultaMovil: true },
          ]}
        >
          {usuarios.map((usuario) => (
            <Fila key={usuario.id} atenuada={!usuario.activo}>
              <Celda>
                <span className="flex items-center gap-2">
                  <Link
                    href={`/usuarios/${usuario.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {usuario.nombre}
                  </Link>
                  {sesion?.user.id === String(usuario.id) ? (
                    <Etiqueta tono="info">Vos</Etiqueta>
                  ) : null}
                  {usuario.activo ? null : <Etiqueta>Inactivo</Etiqueta>}
                </span>
                <span className="mt-0.5 block text-[12px] text-tinta-suave">
                  {usuario.email}
                </span>
              </Celda>
              <Celda>
                <Etiqueta tono={usuario.rol === "ADMINISTRADOR" ? "exito" : "neutro"}>
                  {NOMBRE_ROL[usuario.rol]}
                </Etiqueta>
              </Celda>
              <Celda ocultaMovil className="text-tinta-media">
                {usuario.sucursal?.nombre ?? "—"}
              </Celda>
            </Fila>
          ))}
        </Tabla>
      )}
    </section>
  );
}
