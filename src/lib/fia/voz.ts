import { describirFecha, nombreDeMes, type Periodo } from "../motor/fechas";
import { formatearImporte } from "../motor/importes";
import { capitalizar } from "../motor/texto";

/** Cómo se nombra un período dentro de una frase: "esta semana", "en octubre". */
export function cuando(periodo: Periodo, desde: string): string {
  switch (periodo) {
    case "hoy":
      return "hoy";
    case "semana":
      return "esta semana";
    case "mes":
    case "mes_pasado":
      return `en ${nombreDeMes(desde)}`;
    case "anio":
      return `en ${desde.slice(0, 4)}`;
  }
}

/** Título de un resumen: "Hoy", "Esta semana", "Octubre", "2026". */
export function tituloDePeriodo(periodo: Periodo, desde: string): string {
  return capitalizar(cuando(periodo, desde).replace(/^en /, ""));
}

/** Todo lo que dice Fia, en un solo lugar: tutea de vos, es breve y no da sermones. */
export const voz = {
  bienvenida: "Hola, soy Fia. Vos me contás qué gastaste o cobraste, y yo lo anoto. ¿Cómo te llamo?",
  gusto: (nombre: string) => `Un gusto, ${nombre}. Contame un gasto así como lo dirías:`,
  saludo: (nombre: string | null) => (nombre ? `¡Hola, ${nombre}! ¿Qué anotamos?` : "¡Hola! ¿Qué anotamos?"),
  gracias: "De nada. Para eso estoy.",
  ayuda: "Escribime lo que gastaste o cobraste, con el importe, o mandame una captura de la transferencia. También te armo el resumen, te muestro lo último que anoté y te cuido los frascos.",
  noLoLei: "Eso no lo pude leer. Decímelo con un importe, por ejemplo:",

  propuesta: "¿Lo anoto así?",
  propuestaDuplicada: "Ya tengo uno igual: mismo importe, mismo día. ¿Este es otro?",
  propuestaDudosa: (centavos: number) =>
    `Leí ${formatearImporte(centavos)}, pero ese número se puede leer de dos formas. Revisalo antes de anotar.`,

  pideImporte: "¿Cuánto fue?",
  pideImporteEntreVarios: "Veo más de un número. ¿Cuál es el importe?",
  pideTipo: "¿Fue un gasto o un ingreso?",
  pideSentido: "Esa transferencia, ¿la enviaste o la recibiste?",

  anotado: "Anotado.",
  anotadoEnCategoria: (total: number, categoria: string) =>
    `Anotado. Llevás ${formatearImporte(total)} en ${categoria} este mes.`,
  anotadoSinCategoria: "Anotado. Quedó sin clasificar: con Editar le ponés categoría.",
  anotadoIngreso: (total: number) => `Anotado. Este mes entraron ${formatearImporte(total)}.`,
  anotadoConFecha: (fecha: string, hoy: string) => `Anotado con fecha ${describirFecha(fecha, hoy)}.`,
  guardado: "Guardado.",
  descartado: "Listo, no lo anoto.",
  anulado: "Anulado. Ya no cuenta en tus totales.",

  resumen: "Acá va el resumen.",
  resumenEnRojo: "Acá va el resumen. Ojo: salió más de lo que entró.",
  resumenVacio: (periodo: Periodo, desde: string) => `No anoté nada ${cuando(periodo, desde)}.`,
  gastosDeCategoria: (categoria: string, total: number, cantidad: number, periodo: Periodo, desde: string) =>
    cantidad
      ? `En ${categoria} gastaste ${formatearImporte(total)} ${cuando(periodo, desde)}, en ${cantidad} ${cantidad === 1 ? "movimiento" : "movimientos"}.`
      : `No anoté gastos de ${categoria} ${cuando(periodo, desde)}.`,
  categoriaDesconocida: (buscada: string) =>
    buscada ? `No tengo una categoría que se llame «${buscada}».` : "Decime de qué categoría, por ejemplo: «gastos; comida; este mes».",

  ultimos: "Lo último que anoté:",
  ultimosVacio: "Todavía no anoté nada. Contame un gasto, por ejemplo:",
  deshacer: "Este es el último que anoté. Si estaba mal, tocá Anular.",
  deshacerVacio: "No hay nada anotado para anular.",

  capturaLeyendo: "leyendo la captura…",
  capturaIlegible: "No pude leer esa imagen. Probá de nuevo, o contámelo por texto.",
  capturaVacia: "No encontré ningún movimiento en esa imagen. Probá con una captura más nítida, o contámelo por texto.",
  capturaUna: "Encontré un movimiento en la captura. ¿Lo anoto así?",
  capturaVarias: (cantidad: number) => `Encontré ${cantidad} movimientos en la captura. Revisalos uno por uno.`,
  anotadosVarios: (cantidad: number) => `Anotados ${cantidad} movimientos.`,

  frascos: "Así están tus frascos:",
  frascosVacio: "Todavía no armaste ningún frasco. Probá con «frasco facu 20000».",
  frascoSinNombre: "¿Cómo se llama el frasco? Decímelo así: «frasco facu 20000».",
  frascoNoExiste: (nombre: string) => `No tengo un frasco que se llame «${nombre}».`,
  frascoCreado: (nombre: string, centavos: number | null) =>
    centavos
      ? `Armé el frasco ${nombre} con ${formatearImporte(centavos)}. Cuando un gasto sea de ahí, nombralo y lo descuento.`
      : `Armé el frasco ${nombre}. Está vacío: decime cuánto le ponés, por ejemplo «frasco ${nombre.toLowerCase()} 20000».`,
  frascoSumado: (nombre: string, centavos: number) => `Sumé ${formatearImporte(centavos)} al frasco ${nombre}.`,
  frascoRestado: (nombre: string, centavos: number) => `Saqué ${formatearImporte(centavos)} del frasco ${nombre}.`,
  frascoEstado: (nombre: string) => `Así está el frasco ${nombre}:`,
  frascoBorrado: (nombre: string) => `Borré el frasco ${nombre}. Los gastos que tenía siguen anotados.`,
  anotadoEnFrasco: (nombre: string, queda: number) =>
    queda >= 0
      ? `Anotado. En el frasco ${nombre} te quedan ${formatearImporte(queda)}.`
      : `Anotado. Te pasaste ${formatearImporte(-queda)} del frasco ${nombre}.`,

  borrarMesPregunta: (mes: string, movimientos: number) =>
    `Vas a borrar todo ${mes}: ${movimientos === 1 ? "1 movimiento" : `${movimientos} movimientos`}, este chat y los frascos armados este mes. No se puede deshacer. ¿Lo borro?`,
  mesBorrado: (mes: string, movimientos: number) =>
    `Borré todo ${mes}: ${movimientos === 1 ? "1 movimiento" : `${movimientos} movimientos`}. Arrancamos de cero.`,
  borradoCancelado: "Listo, no borré nada.",

  falla: "No pude guardar eso. Revisá la conexión y probá de nuevo.",
  baseDesactualizada: "A tu base le falta una actualización. Pegá de nuevo el archivo supabase/schema.sql en el SQL Editor de Supabase y volvé a entrar.",
};

/** Frases de ejemplo que Fia ofrece como atajos. */
export const EJEMPLOS = ["gasté 4500 en almuerzo", "cobré 250 lucas de sueldo", "frasco facu 20000", "resumen del mes"];
