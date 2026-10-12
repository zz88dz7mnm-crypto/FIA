import type { Categoria } from "./motor/categorias";
import { sumarDias } from "./motor/fechas";
import { palabras } from "./motor/texto";
import { ES_ENTRADA, type Transaccion } from "./tipos";

/** Cuentas del panel. Todas parten de movimientos confirmados: lo pendiente o anulado no suma. */

export type Totales = { entro: number; salio: number; queda: number };

/** Un tramo del gráfico: un día, o un mes cuando se mira el año. */
export type Punto = { clave: string; etiqueta: string; salio: number; entro: number };

export type GrupoDeGasto = { id: string | null; nombre: string; centavos: number; parte: number };

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function totales(confirmadas: Transaccion[]): Totales {
  let entro = 0;
  let salio = 0;
  for (const t of confirmadas) {
    if (ES_ENTRADA[t.tipo]) entro += t.centavos;
    else salio += t.centavos;
  }
  return { entro, salio, queda: entro - salio };
}

/** Lo que salió, agrupado por categoría y de mayor a menor. `parte` es su fracción del total (0 a 1). */
export function gastoPorCategoria(confirmadas: Transaccion[], categorias: Categoria[]): GrupoDeGasto[] {
  const nombres = new Map(categorias.map((c) => [c.id, c.nombre]));
  const sumas = new Map<string | null, number>();
  for (const t of confirmadas) {
    if (ES_ENTRADA[t.tipo]) continue;
    const id = t.categoriaId && nombres.has(t.categoriaId) ? t.categoriaId : null;
    sumas.set(id, (sumas.get(id) ?? 0) + t.centavos);
  }
  const total = [...sumas.values()].reduce((suma, centavos) => suma + centavos, 0);
  return [...sumas]
    .map(([id, centavos]) => ({ id, nombre: id ? nombres.get(id)! : "Sin clasificar", centavos, parte: total ? centavos / total : 0 }))
    .sort((a, b) => b.centavos - a.centavos);
}

/** Un punto por día del rango; con `porMes`, uno por mes. Los tramos sin movimientos quedan en cero. */
export function serie(confirmadas: Transaccion[], desde: string, hasta: string, porMes = false): Punto[] {
  const puntos = new Map<string, Punto>();
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) {
    const clave = porMes ? dia.slice(0, 7) : dia;
    if (!puntos.has(clave)) {
      const etiqueta = porMes ? MESES_CORTOS[Number(dia.slice(5, 7)) - 1] : String(Number(dia.slice(8, 10)));
      puntos.set(clave, { clave, etiqueta, salio: 0, entro: 0 });
    }
  }
  for (const t of confirmadas) {
    const punto = puntos.get(porMes ? t.fecha.slice(0, 7) : t.fecha);
    if (!punto) continue;
    if (ES_ENTRADA[t.tipo]) punto.entro += t.centavos;
    else punto.salio += t.centavos;
  }
  return [...puntos.values()];
}

/** Cambio porcentual contra el período anterior, redondeado. null si antes no hubo nada para comparar. */
export function variacion(actual: number, previo: number): number | null {
  return previo > 0 ? Math.round(((actual - previo) / previo) * 100) : null;
}

/** Tope redondo para el eje del gráfico: el primer 1, 2 o 5 seguido de ceros que cubre el máximo. */
export function topeRedondo(maximo: number): number {
  if (maximo <= 0) return 0;
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  return [1, 2, 5, 10].map((paso) => paso * magnitud).find((tope) => tope >= maximo)!;
}

/** Una porción del gráfico circular. El color es del nombre: no cambia según el período ni el importe. */
export type Porcion = { clave: string; nombre: string; centavos: number; parte: number; color: string };

// La paleta, en el orden en que se validó para que las porciones vecinas se distingan (también con daltonismo).
const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
// Los tipos de operación de siempre tienen su lugar fijo en la paleta.
const LUGAR_FIJO: Record<string, number> = {
  transferencias: 0,
  "pagos con tarjeta de debito": 1,
  "pagos con qr": 2,
  "pagos de servicios": 3,
  "pagos con tarjeta de credito": 4,
  impuestos: 5,
  "extracciones de efectivo": 6,
};
const COLOR_SIN_NOMBRE = "#8e8e93";
const COLOR_OTRAS = "#c7c7cc";
const PORCIONES_MAXIMAS = 6;

/** Un lugar de la paleta que sale del nombre: el mismo nombre cae siempre en el mismo color. */
function lugarPorNombre(nombre: string): number {
  let suma = 0;
  for (const letra of palabras(nombre)) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return suma % PALETA.length;
}

/**
 * Convierte grupos de gasto en porciones: como mucho seis, las más chicas juntas en "Otras".
 * Sirve tanto para las categorías como para el desglose dentro de una (personas, aclaraciones).
 */
export function porciones(grupos: GrupoDeGasto[]): Porcion[] {
  const total = grupos.reduce((suma, g) => suma + g.centavos, 0);
  const porTamanio = [...grupos].sort((a, b) => b.centavos - a.centavos);
  const visibles = porTamanio.length > PORCIONES_MAXIMAS ? porTamanio.slice(0, PORCIONES_MAXIMAS - 1) : porTamanio;
  const otras = porTamanio.slice(visibles.length).reduce((suma, g) => suma + g.centavos, 0);

  // Primero se sientan los que tienen lugar fijo; después el resto por orden alfabético, cada uno
  // en el lugar que le da su nombre o, si está ocupado, en el siguiente libre.
  const ocupados = new Set<number>();
  const lugares = new Map<GrupoDeGasto, number>();
  const conNombre = visibles.filter((g) => g.id !== null);
  const fijo = (g: GrupoDeGasto) => LUGAR_FIJO[palabras(g.nombre)];
  for (const grupo of conNombre.filter((g) => fijo(g) !== undefined)) {
    ocupados.add(fijo(grupo));
    lugares.set(grupo, fijo(grupo));
  }
  for (const grupo of conNombre.filter((g) => fijo(g) === undefined).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
    let lugar = lugarPorNombre(grupo.nombre);
    while (ocupados.has(lugar)) lugar = (lugar + 1) % PALETA.length;
    ocupados.add(lugar);
    lugares.set(grupo, lugar);
  }

  const resultado: Porcion[] = visibles
    .map((g) => ({ grupo: g, lugar: lugares.get(g) ?? PALETA.length }))
    .sort((a, b) => a.lugar - b.lugar)
    .map(({ grupo, lugar }) => ({
      clave: grupo.id ?? "sin-nombre",
      nombre: grupo.nombre,
      centavos: grupo.centavos,
      parte: grupo.parte,
      color: PALETA[lugar] ?? COLOR_SIN_NOMBRE,
    }));
  if (otras > 0) resultado.push({ clave: "otras", nombre: "Otras", centavos: otras, parte: total ? otras / total : 0, color: COLOR_OTRAS });
  return resultado;
}

/**
 * Lo que salió dentro de una categoría, separado por su aclaración: la persona en una
 * transferencia, el comercio en un pago, o lo que se haya aclarado al anotar el gasto.
 * `categoriaId` nulo = los movimientos sin clasificar.
 */
export function detalleDeCategoria(confirmadas: Transaccion[], categoriaId: string | null): GrupoDeGasto[] {
  const grupos = new Map<string, { nombre: string; centavos: number }>();
  for (const t of confirmadas) {
    if (ES_ENTRADA[t.tipo] || t.categoriaId !== categoriaId) continue;
    const nombre = (t.contraparte ?? "").trim();
    const clave = nombre.toLocaleLowerCase("es-AR");
    const grupo = grupos.get(clave) ?? { nombre, centavos: 0 };
    grupo.centavos += t.centavos;
    grupos.set(clave, grupo);
  }
  const total = [...grupos.values()].reduce((suma, g) => suma + g.centavos, 0);
  return [...grupos]
    .map(([clave, g]) => ({ id: clave || null, nombre: g.nombre || "Sin aclaración", centavos: g.centavos, parte: total ? g.centavos / total : 0 }))
    .sort((a, b) => b.centavos - a.centavos);
}

/** "9 oct": fecha corta para tablas. */
export function fechaCorta(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
}
