import { Prisma } from "@prisma/client";

/**
 * Lectura y validación de formularios en server actions.
 *
 * Se resuelve a mano en vez de sumar una librería de esquemas: los formularios
 * de datos maestros son pocos y planos, y la especificación pide justificar
 * cada dependencia nueva.
 */
export type EstadoFormulario = {
  /** Error general, no atribuible a un campo. */
  error: string | null;
  /** Errores por nombre de campo. */
  errores: Readonly<Record<string, string>>;
  /** Confirmación para formularios que no redirigen al guardar. */
  exito?: string | null;
};

export const FORMULARIO_INICIAL: EstadoFormulario = { error: null, errores: {} };

/** Tope de `Decimal(10, 2)` en el schema. */
const MONTO_MAXIMO = 99_999_999.99;

/** Tope de un `Int` de Postgres. */
const ENTERO_MAXIMO = 2_147_483_647;

export function leerFormulario(datos: FormData) {
  const errores: Record<string, string> = {};

  function crudo(campo: string): string {
    const valor = datos.get(campo);
    // Colapsa espacios repetidos: "Tomate   cherry" y "Tomate cherry" son el mismo nombre.
    return typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  }

  function fallar(campo: string, mensaje: string) {
    errores[campo] ??= mensaje;
  }

  return {
    fallar,

    /** Texto obligatorio. */
    texto(campo: string, { max = 120 }: { max?: number } = {}): string {
      const valor = crudo(campo);
      if (!valor) fallar(campo, "Campo obligatorio.");
      else if (valor.length > max) fallar(campo, `Máximo ${max} caracteres.`);
      return valor;
    },

    /** Texto opcional: vacío se guarda como `null`. */
    textoOpcional(
      campo: string,
      { max = 120, patron, mensaje }: { max?: number; patron?: RegExp; mensaje?: string } = {},
    ): string | null {
      const valor = crudo(campo);
      if (!valor) return null;
      if (valor.length > max) fallar(campo, `Máximo ${max} caracteres.`);
      else if (patron && !patron.test(valor)) fallar(campo, mensaje ?? "Formato inválido.");
      return valor;
    },

    entero(campo: string, { min = 1 }: { min?: number } = {}): number {
      const valor = crudo(campo);
      const numero = Number(valor);
      if (!valor) fallar(campo, "Campo obligatorio.");
      else if (!Number.isInteger(numero)) fallar(campo, "Debe ser un número entero.");
      else if (numero < min || numero > ENTERO_MAXIMO) fallar(campo, `Debe ser mayor o igual a ${min}.`);
      return numero;
    },

    /** Monto en pesos. Con `opcional`, vacío se guarda como `null`. */
    monto<O extends boolean = false>(
      campo: string,
      { opcional }: { opcional?: O } = {},
    ): O extends true ? number | null : number {
      type Retorno = O extends true ? number | null : number;
      const valor = crudo(campo);

      if (!valor) {
        if (!opcional) fallar(campo, "Campo obligatorio.");
        return (opcional ? null : 0) as Retorno;
      }

      const numero = Number(valor);
      if (!Number.isFinite(numero) || numero < 0) fallar(campo, "Ingresá un monto válido.");
      else if (numero > MONTO_MAXIMO) fallar(campo, "Monto demasiado alto.");

      return (Math.round(numero * 100) / 100) as Retorno;
    },

    /** Fecha `YYYY-MM-DD` de un `<input type="date">`, guardada a medianoche UTC. */
    fechaOpcional(campo: string): Date | null {
      const valor = crudo(campo);
      if (!valor) return null;

      const fecha = new Date(`${valor}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(fecha.getTime())) {
        fallar(campo, "Fecha inválida.");
        return null;
      }
      return fecha;
    },

    /** Id de una relación elegida en un `<select>`. */
    id(campo: string, mensaje: string): number {
      const numero = Number(crudo(campo));
      if (!Number.isInteger(numero) || numero <= 0) fallar(campo, mensaje);
      return numero;
    },

    idOpcional(campo: string): number | null {
      const valor = crudo(campo);
      if (!valor) return null;
      const numero = Number(valor);
      if (!Number.isInteger(numero) || numero <= 0) {
        fallar(campo, "Opción inválida.");
        return null;
      }
      return numero;
    },

    /** Valor de un enum. Si llega algo fuera de la lista, se marca el error. */
    opcion<T extends string>(campo: string, opciones: readonly T[]): T {
      const valor = crudo(campo);
      if (!opciones.includes(valor as T)) fallar(campo, "Elegí una opción.");
      return valor as T;
    },

    /** Interruptor activo/inactivo, enviado como "si" / "no". */
    booleano(campo: string): boolean {
      return crudo(campo) === "si";
    },

    get valido() {
      return Object.keys(errores).length === 0;
    },

    estado(error: string | null = null): EstadoFormulario {
      return { error, errores: { ...errores } };
    },
  };
}

/**
 * Detecta una violación de unicidad de Prisma y devuelve qué campo la causó.
 *
 * Las acciones ya chequean duplicados antes de escribir; esto cubre la carrera
 * en la que dos administradores guardan el mismo valor al mismo tiempo.
 */
export function campoDuplicado(error: unknown, campos: readonly string[]): string | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }

  const objetivo = JSON.stringify(error.meta?.target ?? "");
  return campos.find((campo) => objetivo.includes(campo)) ?? campos[0] ?? null;
}

/** Error de clave foránea: la relación elegida ya no existe. */
export function esRelacionInvalida(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2025")
  );
}
