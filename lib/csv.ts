/*
 * CSV para Excel en español, sin librerías (sección 6.4 de
 * Especificacion_Gastos.md): separador `;` y BOM UTF-8, así Excel abre el
 * archivo con las tildes bien y una columna por campo.
 */

const SEPARADOR = ";";
const BOM = "﻿";

/**
 * Un campo del CSV. Va entre comillas si trae separador, comillas o saltos de
 * línea. Un texto que empieza con `=`, `+`, `-` o `@` se precede con un
 * apóstrofo: si no, Excel lo ejecuta como fórmula (una descripción escrita por
 * un usuario nunca debe poder hacer eso).
 */
function campo(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Arma el archivo completo: encabezado + filas, con fin de línea CRLF. */
export function armarCsv(encabezado: readonly string[], filas: readonly (readonly string[])[]): string {
  const lineas = [encabezado, ...filas].map((fila) => fila.map(campo).join(SEPARADOR));
  return `${BOM}${lineas.join("\r\n")}\r\n`;
}
