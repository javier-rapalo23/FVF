/**
 * Utilidades de los listados de gestión, que filtran del lado del servidor a
 * partir de los parámetros de la URL.
 */
export type ParametrosBusqueda = Promise<Record<string, string | string[] | undefined>>;

/** Lee los parámetros de la URL como strings planos (el primero si se repiten). */
export async function leerParametros(
  parametros: ParametrosBusqueda,
): Promise<Record<string, string>> {
  const crudos = await parametros;
  return Object.fromEntries(
    Object.entries(crudos).map(([clave, valor]) => [
      clave,
      (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "",
    ]),
  );
}

/** Filtro de estado compartido: por defecto se listan solo los activos. */
export const OPCIONES_ESTADO = [
  { valor: "", label: "Activos" },
  { valor: "inactivos", label: "Inactivos" },
  { valor: "todos", label: "Todos" },
] as const;

export function filtroActivo(estado: string | undefined): { activo?: boolean } {
  if (estado === "todos") return {};
  return { activo: estado !== "inactivos" };
}
