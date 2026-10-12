import type { Tramo } from "./texto";

/** Las fechas viajan como texto "AAAA-MM-DD"; `hoy` siempre llega desde afuera. */
export type FechaLeida = Tramo & { fecha: string };

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split("-").map(Number);
  return [a, m, d];
}

function armar(anio: number, mes: number, dia: number): string | null {
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  const valida = f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
  return valida ? f.toISOString().slice(0, 10) : null;
}

export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function diaDeSemana(iso: string): number {
  const [a, m, d] = partes(iso);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Una fecha sin año se asume del año en curso; si quedara en el futuro, del anterior. */
function sinAnio(mes: number, dia: number, hoy: string): string | null {
  const [anio] = partes(hoy);
  const esteAnio = armar(anio, mes, dia);
  if (esteAnio && esteAnio <= hoy) return esteAnio;
  return armar(anio - 1, mes, dia);
}

/** Busca una fecha en un texto plano. Devuelve la primera que encuentre. */
export function buscarFecha(textoPlano: string, hoy: string): FechaLeida | null {
  let m: RegExpExecArray | null;

  if ((m = /\b(antes de ayer|anteayer)\b/.exec(textoPlano))) {
    return { inicio: m.index, fin: m.index + m[0].length, fecha: sumarDias(hoy, -2) };
  }
  if ((m = /\b(hoy|ayer)\b/.exec(textoPlano))) {
    return { inicio: m.index, fin: m.index + m[0].length, fecha: sumarDias(hoy, m[1] === "hoy" ? 0 : -1) };
  }

  // "5/10" · "05/10/2026" · "5-10-26"
  if ((m = /(?<![\w/])(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?(?![\w/])/.exec(textoPlano))) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const fecha = m[3]
      ? armar(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), mes, dia)
      : sinAnio(mes, dia, hoy);
    if (fecha) return { inicio: m.index, fin: m.index + m[0].length, fecha };
  }

  // "5 de octubre" · "el 5 de octubre de 2025"
  const conMes = new RegExp(String.raw`\b(?:el\s+)?(\d{1,2})\s+de\s+(${MESES.join("|")})(?:\s+(?:de|del)\s+(\d{4}))?\b`);
  if ((m = conMes.exec(textoPlano))) {
    const dia = Number(m[1]);
    const mes = MESES.indexOf(m[2]) + 1;
    const fecha = m[3] ? armar(Number(m[3]), mes, dia) : sinAnio(mes, dia, hoy);
    if (fecha) return { inicio: m.index, fin: m.index + m[0].length, fecha };
  }

  // "el viernes": el más reciente anterior a hoy
  const conDia = new RegExp(String.raw`\b(?:el\s+)?(${DIAS.join("|")})(?:\s+pasado)?\b`);
  if ((m = conDia.exec(textoPlano))) {
    const atras = (diaDeSemana(hoy) - DIAS.indexOf(m[1]) + 7) % 7 || 7;
    return { inicio: m.index, fin: m.index + m[0].length, fecha: sumarDias(hoy, -atras) };
  }

  return null;
}

export type Periodo = "hoy" | "semana" | "mes" | "mes_pasado" | "anio";

/** Reconoce un período en un texto plano; por defecto, el mes en curso. */
export function buscarPeriodo(textoPlano: string): Periodo {
  if (/\bmes (pasado|anterior)\b/.test(textoPlano)) return "mes_pasado";
  if (/\bhoy\b/.test(textoPlano)) return "hoy";
  if (/\bsemana\b/.test(textoPlano)) return "semana";
  if (/\bano\b/.test(textoPlano)) return "anio";
  return "mes";
}

/** Primer y último día (inclusive) de un período. La semana va de lunes a domingo. */
export function rangoDe(periodo: Periodo, hoy: string): { desde: string; hasta: string } {
  const [anio, mes] = partes(hoy);
  const finDeMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);

  switch (periodo) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "semana": {
      const desde = sumarDias(hoy, -((diaDeSemana(hoy) + 6) % 7));
      return { desde, hasta: sumarDias(desde, 6) };
    }
    case "mes":
      return { desde: armar(anio, mes, 1)!, hasta: finDeMes(anio, mes) };
    case "mes_pasado": {
      const a = mes === 1 ? anio - 1 : anio;
      const m = mes === 1 ? 12 : mes - 1;
      return { desde: armar(a, m, 1)!, hasta: finDeMes(a, m) };
    }
    case "anio":
      return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  }
}

/** "hoy" · "ayer" · "5 de octubre" · "5 de octubre de 2025" */
export function describirFecha(iso: string, hoy: string): string {
  if (iso === hoy) return "hoy";
  if (iso === sumarDias(hoy, -1)) return "ayer";
  const [anio, mes, dia] = partes(iso);
  const base = `${dia} de ${MESES[mes - 1]}`;
  return anio === partes(hoy)[0] ? base : `${base} de ${anio}`;
}

export function nombreDeMes(iso: string): string {
  return MESES[partes(iso)[1] - 1];
}
