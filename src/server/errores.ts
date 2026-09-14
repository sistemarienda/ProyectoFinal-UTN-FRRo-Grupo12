/**
 * Traducción de los errores de la base a algo que se pueda leer en pantalla.
 *
 * PostgREST devuelve el mensaje de PostgreSQL tal cual, y PostgreSQL habla en
 * inglés: «duplicate key value violates unique constraint
 * "comprobante_numero_unico"». Eso llegaba entero al usuario, que además de no
 * estar en español le muestra el nombre interno de una restricción.
 *
 * Dos criterios:
 *
 * 1. **Los mensajes propios pasan de largo.** Los disparantes que escribimos
 *    -«Una orden anulada está cerrada», «La orden ya salió»- ya están redactados
 *    para el usuario y llegan con `errcode` de violación de CHECK. Traducirlos
 *    de nuevo sería reemplazar una explicación buena por una genérica.
 *
 * 2. **Lo que no se reconoce se dice en general, no se muestra crudo.** Un
 *    mensaje interno en pantalla no ayuda a quien lo lee y expone nombres de
 *    tablas y restricciones. El detalle sigue estando en el registro del
 *    servidor, que es donde se diagnostica.
 */

export interface ErrorDeBase {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Restricciones cuyo choque tiene una explicación concreta que darle al usuario. */
const POR_RESTRICCION: Record<string, string> = {
  comprobante_numero_unico:
    'Ese número de comprobante ya está usado en el punto de venta. Actualizá el último número autorizado en Configuración antes de volver a emitir.',
  detalle_insumo_unico: 'Ese insumo ya figura en la orden. Corregí la cantidad del renglón existente.',
  persona_documento_unico: 'Ya hay una persona registrada con ese tipo y número de documento.',
  usuario_persona_unica: 'Esa persona ya tiene un usuario del sistema.',
  orden_compra_numero_unico: 'Ese número de orden ya está usado en el año.',
  estado_cuenta_periodo_unico: 'Ya se emitió un estado de cuenta para ese cliente y ese período.',
};

/**
 * Un mensaje escrito por nosotros se reconoce porque lo levantó un `raise
 * exception` de los invariantes, que siempre viaja con código de violación de
 * CHECK y ya viene en castellano.
 */
function esMensajePropio(e: ErrorDeBase): boolean {
  return e.code === '23514' || e.code === 'P0001';
}

export function mensajeDeError(e: ErrorDeBase | null | undefined, porOmision?: string): string {
  const generico = porOmision ?? 'No se pudo completar la operación.';
  if (!e) return generico;

  if (esMensajePropio(e) && e.message) return e.message;

  switch (e.code) {
    case '23505': {
      const nombre = /"([^"]+)"/.exec(e.message ?? '')?.[1] ?? '';
      return POR_RESTRICCION[nombre] ?? 'Ya existe un registro con esos datos.';
    }
    case '23503':
      return 'No se puede completar: hay otros registros que dependen de este.';
    case '23502':
      return 'Falta completar un dato obligatorio.';
    case '22P02':
    case '22007':
      return 'Alguno de los valores no tiene el formato esperado.';
    case '42501':
      return 'Tu usuario no tiene permiso para esta operación.';
    default:
      return generico;
  }
}
