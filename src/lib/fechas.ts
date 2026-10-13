/**
 * Una fecha de la base (`AAAA-MM-DD`, o el comienzo de un `timestamptz`) como
 * se lee en Argentina: `dd/mm/aaaa`.
 *
 * Se arma cortando el texto y no con `toLocaleDateString`, porque un `date`
 * convertido a `Date` es la medianoche UTC, y en la zona del haras eso cae el
 * día anterior.
 */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}
