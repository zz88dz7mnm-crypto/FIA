/**
 * Versión "plana" de un texto: minúsculas y sin acentos, con el MISMO largo que
 * el original. Así una posición encontrada en el texto plano sirve para cortar
 * el original sin perderle los acentos.
 */
export function plano(texto: string): string {
  let salida = "";
  for (const unidad of texto.normalize("NFC").split("")) {
    const base = unidad.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    salida += base.length === 1 ? base : unidad.toLowerCase().charAt(0) || " ";
  }
  return salida;
}

/** Texto plano, sin signos y con espacios simples: la forma en que se comparan palabras clave. */
export function palabras(texto: string): string {
  return plano(texto)
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export type Tramo = { inicio: number; fin: number };

/** Devuelve el texto sin los tramos indicados (posiciones sobre el original). */
export function quitarTramos(texto: string, tramos: Tramo[]): string {
  const ordenados = [...tramos].sort((a, b) => a.inicio - b.inicio);
  let salida = "";
  let cursor = 0;
  for (const tramo of ordenados) {
    if (tramo.inicio < cursor) continue;
    salida += texto.slice(cursor, tramo.inicio) + " ";
    cursor = tramo.fin;
  }
  return salida + texto.slice(cursor);
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("es-AR") + texto.slice(1);
}
