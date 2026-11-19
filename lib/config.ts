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

/** A partir de cuántos días se avisa que un producto está por vencer. */
export const DIAS_AVISO_VENCIMIENTO = 7;

/**
 * Ventana del aviso de conteo: ventas sin conexión sincronizadas en estas
 * últimas horas, cobradas antes del último conteo del producto.
 */
export const HORAS_AVISO_VENTA_OFFLINE = 24;

/** Diferencia de un cierre de caja (en lempiras) a partir de la cual la nota es obligatoria. */
export const DIFERENCIA_CIERRE_NOTA = 20;

/** Billetes y monedas de Honduras para el conteo de caja, de mayor a menor. */
export const DENOMINACIONES = [
  "500",
  "200",
  "100",
  "50",
  "20",
  "10",
  "5",
  "2",
  "1",
  "0.5",
  "0.2",
  "0.1",
] as const;
