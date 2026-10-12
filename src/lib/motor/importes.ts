import type { Tramo } from "./texto";

/** Todos los importes se manejan en centavos enteros: nunca en punto flotante. */
export type ImporteLeido = Tramo & {
  centavos: number;
  /** El formato admite más de una lectura (p. ej. "4,500"): hay que confirmarlo. */
  dudoso: boolean;
};

const MULTIPLICADORES: Record<string, number> = {
  k: 1_000,
  mil: 1_000,
  luca: 1_000,
  lucas: 1_000,
  palo: 1_000_000,
  palos: 1_000_000,
  millon: 1_000_000,
  millones: 1_000_000,
};

const UNIDADES = "k|mil|lucas?|palos?|millon(?:es)?";

// "4500" · "4.500" · "4.500,50" · "4500,5" · "$ 12k" · "12 lucas" · "1,5 palos"
const CON_NUMERO = new RegExp(
  String.raw`(?<![\w.,/])\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d+)?)(?:\s*(${UNIDADES})\b)?(?![\w/]|[.,]\d)`,
  "g",
);

// "una luca" · "un palo" · "medio palo" · "media luca"
const CON_PALABRA = new RegExp(String.raw`\b(un|una|medio|media)\s+(luca|palo|millon)\b`, "g");

function leerNumero(crudo: string): { entero: number; decimales: string; dudoso: boolean } {
  // Miles con punto, decimales con coma: "1.234.567,89"
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(crudo)) {
    const [entero, decimales = ""] = crudo.split(",");
    return { entero: Number(entero.replaceAll(".", "")), decimales, dudoso: false };
  }
  const separador = crudo.match(/[.,]/)?.[0];
  if (!separador) return { entero: Number(crudo), decimales: "", dudoso: false };

  const [entero, resto] = crudo.split(separador);
  // "4,500": en Argentina la coma es decimal, pero tres dígitos sugieren miles.
  if (resto.length === 3 && entero.length <= 3) {
    return { entero: Number(entero + resto), decimales: "", dudoso: true };
  }
  return { entero: Number(entero), decimales: resto, dudoso: resto.length > 2 };
}

function aCentavos(entero: number, decimales: string, multiplicador: number): number {
  const escala = 10 ** decimales.length;
  const sinComa = entero * escala + Number(decimales || 0);
  return Math.round((sinComa * multiplicador * 100) / escala);
}

/** Busca importes en un texto plano (ver `plano`). */
export function buscarImportes(textoPlano: string): ImporteLeido[] {
  const hallados: ImporteLeido[] = [];

  for (const m of textoPlano.matchAll(CON_NUMERO)) {
    const { entero, decimales, dudoso } = leerNumero(m[1]);
    const centavos = aCentavos(entero, decimales, MULTIPLICADORES[m[2] ?? ""] ?? 1);
    if (centavos <= 0) continue;
    const sobra = m[0].length - m[0].trimStart().length;
    hallados.push({ inicio: m.index + sobra, fin: m.index + m[0].length, centavos, dudoso });
  }

  for (const m of textoPlano.matchAll(CON_PALABRA)) {
    const mitad = m[1].startsWith("medi");
    const centavos = (MULTIPLICADORES[m[2]] * 100) / (mitad ? 2 : 1);
    hallados.push({ inicio: m.index, fin: m.index + m[0].length, centavos, dudoso: false });
  }

  return hallados.sort((a, b) => a.inicio - b.inicio);
}

/** "$4.500" · "$4.500,50" (los centavos solo se muestran si existen). */
export function formatearImporte(centavos: number): string {
  const absoluto = Math.abs(centavos);
  const entero = Math.trunc(absoluto / 100);
  const resto = absoluto % 100;
  const miles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimales = resto ? "," + String(resto).padStart(2, "0") : "";
  return `${centavos < 0 ? "-" : ""}$${miles}${decimales}`;
}

/** Centavos → texto decimal exacto para la base ("4500.50"). */
export function centavosADecimal(centavos: number): string {
  const absoluto = Math.abs(centavos);
  const cuerpo = `${Math.trunc(absoluto / 100)}.${String(absoluto % 100).padStart(2, "0")}`;
  return centavos < 0 ? `-${cuerpo}` : cuerpo;
}

/** Valor decimal de la base (número o texto) → centavos. */
export function decimalACentavos(valor: number | string): number {
  const [entero, decimales = ""] = String(valor).trim().replace("-", "").split(".");
  const centavos = Number(entero) * 100 + Number(decimales.padEnd(2, "0").slice(0, 2));
  return String(valor).trim().startsWith("-") ? -centavos : centavos;
}
