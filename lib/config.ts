/**
 * Constantes del negocio. Cambiar un valor acá alcanza para toda la app:
 * ningún componente escribe estas etiquetas a mano.
 */

/** Nombre que encabeza el comprobante interno. */
export const NOMBRE_NEGOCIO = "Inversiones Ferrera";

/** Etiqueta de la unidad de los productos que se venden por peso. */
export const UNIDAD_PESO = "lb";

/** Zona horaria del negocio: define qué es "hoy" (UTC−6, sin horario de verano). */
export const ZONA_HORARIA = "America/Tegucigalpa";

/** Máximo por línea de venta, para frenar errores de tipeo. */
export const CANTIDAD_MAXIMA_LINEA = 9999;

/** Máximo por línea de compra: entra mercadería por mayor. */
export const CANTIDAD_MAXIMA_COMPRA = 99_999;

/** Cuántos días atrás se acepta la fecha de una compra. */
export const DIAS_ATRAS_COMPRA = 60;

/** Variación del costo respecto del último que dispara la advertencia. */
export const VARIACION_COSTO_AVISO = 0.3;
