import type { Categoria } from "./motor/categorias";
import { sumarDias } from "./motor/fechas";
import { ES_ENTRADA, type Transaccion } from "./tipos";

/** Cuentas del panel. Todas parten de movimientos confirmados: lo pendiente o anulado no suma. */

export type Totales = { entro: number; salio: number; queda: number };

/** Un tramo del gráfico: un día, o un mes cuando se mira el año. */
export type Punto = { clave: string; etiqueta: string; salio: number; entro: number };

export type GrupoDeGasto = { id: string | null; nombre: string; centavos: number; parte: number };

/** Lo que se le envió y lo que se recibió de una misma persona. */
export type Persona = { nombre: string; enviado: number; recibido: number; cantidad: number };

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

/** Las transferencias agrupadas por persona, ordenadas por cuánta plata se movió con cada una. */
export function transferenciasPorPersona(confirmadas: Transaccion[]): Persona[] {
  const personas = new Map<string, Persona>();
  for (const t of confirmadas) {
    if (t.tipo !== "transferencia_enviada" && t.tipo !== "transferencia_recibida") continue;
    const nombre = (t.contraparte ?? t.descripcion).trim() || "Sin nombre";
    const clave = nombre.toLocaleLowerCase("es-AR");
    const persona = personas.get(clave) ?? { nombre, enviado: 0, recibido: 0, cantidad: 0 };
    if (t.tipo === "transferencia_enviada") persona.enviado += t.centavos;
    else persona.recibido += t.centavos;
    persona.cantidad += 1;
    personas.set(clave, persona);
  }
  return [...personas.values()].sort((a, b) => b.enviado + b.recibido - (a.enviado + a.recibido));
}

/** "9 oct": fecha corta para tablas. */
export function fechaCorta(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
}
