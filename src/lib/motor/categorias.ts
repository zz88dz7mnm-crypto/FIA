import { palabras } from "./texto";

export type Categoria = {
  id: string;
  nombre: string;
  clase: "gasto" | "ingreso";
  palabrasClave: string[];
};

/** Regla del usuario: si aparece `patron`, va a esa categoría. Gana sobre las palabras base. */
export type ReglaPersonal = { patron: string; categoriaId: string };

/** Posición de una frase como palabra entera (admite plural simple), o -1. */
function posicion(frase: string, texto: string): number {
  const clave = palabras(frase);
  if (!clave) return -1;
  const posiciones = [` ${clave} `, ` ${clave}s `, ` ${clave}es `]
    .map((variante) => texto.indexOf(variante))
    .filter((p) => p >= 0);
  return posiciones.length ? Math.min(...posiciones) : -1;
}

/**
 * Sugiere una categoría para un texto. Si coinciden varias, gana la frase más
 * larga (más específica) y, a igualdad, la que aparece antes. Sin coincidencia
 * devuelve null: el movimiento queda "Sin clasificar".
 */
export function clasificar(texto: string, categorias: Categoria[], reglas: ReglaPersonal[] = []): Categoria | null {
  const buscable = ` ${palabras(texto)} `;
  const porId = new Map(categorias.map((c) => [c.id, c]));

  const personales = reglas
    .filter((r) => porId.has(r.categoriaId) && posicion(r.patron, buscable) >= 0)
    .sort((a, b) => b.patron.length - a.patron.length);
  if (personales.length) return porId.get(personales[0].categoriaId)!;

  let mejor: { categoria: Categoria; largo: number; pos: number } | null = null;
  for (const categoria of categorias) {
    for (const frase of [categoria.nombre, ...categoria.palabrasClave]) {
      const pos = posicion(frase, buscable);
      if (pos < 0) continue;
      const largo = palabras(frase).length;
      if (!mejor || largo > mejor.largo || (largo === mejor.largo && pos < mejor.pos)) {
        mejor = { categoria, largo, pos };
      }
    }
  }
  return mejor?.categoria ?? null;
}
