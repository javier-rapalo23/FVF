/**
 * Sub-navegación del módulo para el administrador: resumen, gastos fijos y
 * conceptos viven dentro de Gastos, cada uno con su permiso en `lib/permissions.ts`.
 */
export const PESTANAS_GASTOS = [
  { href: "/gastos", label: "Gastos" },
  { href: "/gastos/resumen", label: "Resumen" },
  { href: "/gastos/fijos", label: "Fijos" },
  { href: "/gastos/conceptos", label: "Conceptos" },
] as const;
