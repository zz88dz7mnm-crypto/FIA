import { buscarFecha } from "./fechas";
import type { Tipo } from "./interpretar";
import { capitalizar, palabras, plano } from "./texto";

/** Una operación encontrada en el texto de una captura. Lo que no se pudo leer queda en null. */
export type OperacionLeida = {
  /** null: la captura no deja claro si la plata entró o salió. */
  tipo: Tipo | null;
  centavos: number;
  /** null: no hay una fecha legible. */
  fecha: string | null;
  descripcion: string;
  contraparte: string | null;
  referencia: string | null;
  importeDudoso: boolean;
  /** Categoría sugerida según el tipo de operación ("Transferencias", "Pagos con tarjeta"…), o null. */
  rubro: string | null;
  /** Movimiento entre cuentas o frascos propios: se anota, pero no cuenta como gasto ni como ingreso. */
  interna: boolean;
};

type Importe = { centavos: number; signo: "+" | "-" | null; dudoso: boolean; resto: string };

// Solo cuenta como importe lo que lleva "$": así no se confunden CBU, horas ni números de operación.
// Admite los centavos en superíndice, que el OCR devuelve pegados ("8.00000") o sueltos ("8.000 00").
const IMPORTE =
  /([+\-−–—])?\s*\$\s*([+\-−–—])?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2})(?!\d)|(\d{2})(?!\d)|\s(\d{2})(?![\d:/.,]))?/g;

const SALDO = /\b(saldo|disponible|tu dinero|dinero en cuenta)\b/;
// Renglones de detalle dentro de un comprobante. En un listado, en cambio, son operaciones.
const CARGOS = /\b(comision|impuestos?|iva)\b/;

const RECIBIDA = /\b(transferencia recibida|recibiste|te transfirio|te transfirieron|te envio|dinero recibido|te pago)\b/;
const ENVIADA = /\b(transferencia enviada|transferencia realizada|transferencia exitosa|le transferiste|transferiste|le enviaste|enviaste|dinero enviado)\b/;
const INGRESO = /\b(ingreso de dinero|ingresaste|acreditacion|acreditamos|sueldo|haberes|reintegro|devolucion|rendimientos?|cobraste)\b/;
const GASTO = /\b(pagaste|compraste|compra|pago)\b/;
// Marcas y etiquetas que contienen "pago" sin que haya un pago.
const RUIDO = /mercado pago|medios? de pago|metodo de pago/g;

const TITULO_GENERICO =
  /^(transferencia( enviada| recibida| realizada| exitosa)?|pago( con qr| realizado| exitoso)?|compra|ingreso de dinero|dinero (recibido|enviado)|enviaste|recibiste|pagaste)$/;

const COMPROBANTE = /\b(comprobante|operacion|coelsa|cvu|cbu|destinatario|beneficiario)\b/;

// El tipo de operación define la categoría. Se prueban en este orden: gana la primera que coincide.
const RUBROS: [RegExp, string][] = [
  [/\bfrascos?\b|\bentre (mis |tus )?cuentas\b|\breservas?\b/, "Entre mis cuentas"],
  [/\brendimientos?\b|\bintereses\b/, "Rendimientos diarios"],
  [/\bimpuestos?\b|\bpercepcion(es)?\b|\bretencion(es)?\b|\bingresos brutos\b|\biibb\b|\bsellos\b|\bafip\b|\barca\b/, "Impuestos"],
  [/\bqr\b/, "Pagos con QR"],
  [/\bdebito\b/, "Pagos con tarjeta de débito"],
  [/\bcredito\b|\bcuotas\b/, "Pagos con tarjeta de crédito"],
  [/\bpagos? de servicios?\b|\brecargas?\b|\bsube\b/, "Pagos de servicios"],
  [/\bextraccion(es)?\b|\bretiros? de efectivo\b|\bcajero\b/, "Extracciones de efectivo"],
  [/\btransferencias?\b|\btransferiste\b|\bte transfirio\b/, "Transferencias"],
  [/\bingreso de dinero\b|\bingresaste\b|\bsueldo\b|\bhaberes\b|\bacreditacion\b|\bdevolucion\b|\breintegro\b/, "Ingresos"],
];
const RUBRO_INTERNO = "Entre mis cuentas";

function rubroDe(textoPlano: string): string | null {
  const limpio = textoPlano.replace(RUIDO, " ");
  return RUBROS.find(([patron]) => patron.test(limpio))?.[1] ?? null;
}

/** ¿Este renglón dice qué tipo de operación es ("Transferencia enviada", "Pago con tarjeta de débito")? */
function esTipoDeOperacion(texto: string): boolean {
  const p = plano(texto).replace(RUIDO, " ");
  return TITULO_GENERICO.test(palabras(texto)) || rubroDe(p) !== null || RECIBIDA.test(p) || ENVIADA.test(p) || INGRESO.test(p) || GASTO.test(p);
}

function importesDe(linea: string): Importe[] {
  const hallados: Importe[] = [];
  for (const m of linea.matchAll(IMPORTE)) {
    const [, signoAntes, signoDespues, entero, conComa, pegados, sueltos] = m;
    const decimales = (conComa ?? pegados ?? sueltos ?? "").padEnd(2, "0");
    const centavos = Number(entero.replaceAll(".", "")) * 100 + Number(decimales);
    if (centavos <= 0) continue;
    const signo = signoAntes ?? signoDespues;
    hallados.push({
      centavos,
      signo: !signo ? null : signo === "+" ? "+" : "-",
      // Dudoso: cifras largas sin puntos ("50000" puede ser 500,00) o centavos sueltos que no son "00".
      dudoso: (!entero.includes(".") && entero.length >= 5) || (sueltos !== undefined && sueltos !== "00"),
      resto: (linea.slice(0, m.index) + " " + linea.slice(m.index + m[0].length)).trim(),
    });
  }
  return hallados;
}

/** Quita horas y símbolos sueltos; devuelve "" si no queda un texto que sirva de descripción. */
function textoUtil(linea: string): string {
  const limpio = linea
    .replace(/\b\d{1,2}:\d{2}(\s?hs)?\b/gi, " ")
    .replace(/[•·|>›<]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[\s\-–—.,:]+$/gu, "");
  return /\p{L}{3,}/u.test(limpio) ? limpio : "";
}

/** "MARIA LOPEZ" → "Maria Lopez". Lo que ya viene en minúsculas no se toca. */
function nombrePropio(texto: string): string {
  if (texto !== texto.toUpperCase()) return texto;
  return texto.toLowerCase().replace(/(^|\s)\p{L}/gu, (inicial) => inicial.toUpperCase());
}

function sentidoDe(textoPlano: string, signo: Importe["signo"]): Tipo | null {
  const t = textoPlano.replace(RUIDO, " ");
  if (RECIBIDA.test(t)) return "transferencia_recibida";
  if (ENVIADA.test(t)) return "transferencia_enviada";
  if (signo && /\btransferencia\b/.test(t)) return signo === "+" ? "transferencia_recibida" : "transferencia_enviada";
  if (INGRESO.test(t) || signo === "+") return "ingreso";
  if (GASTO.test(t) || signo === "-") return "gasto";
  return null;
}

/** ¿La línea es solo una fecha ("Hoy", "Jueves 9 de octubre")? En los listados encabeza un grupo. */
function fechaDeEncabezado(lineaPlana: string, hoy: string): string | null {
  const hallada = buscarFecha(lineaPlana, hoy, { abreviados: true });
  if (!hallada) return null;
  const sobra = palabras(lineaPlana.slice(0, hallada.inicio) + " " + lineaPlana.slice(hallada.fin))
    .replace(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|de|del|el)\b/g, "")
    .trim();
  return sobra.length < 3 ? hallada.fecha : null;
}

const noFutura = (fecha: string | null | undefined, hoy: string) => (fecha && fecha <= hoy ? fecha : null);

/** Valor de un campo de comprobante: "Para: Maria" en la misma línea, o "Para" y el valor en la siguiente. */
function campo(lineas: string[], planas: string[], etiqueta: string): string | null {
  const sola = new RegExp(`^(?:${etiqueta}):?$`);
  const conValor = new RegExp(`^(?:${etiqueta})\\s*:\\s*(\\S.*)$`);
  for (let i = 0; i < planas.length; i++) {
    if (sola.test(planas[i])) return lineas[i + 1] ?? null;
    const m = conValor.exec(planas[i]);
    if (m) return lineas[i].slice(lineas[i].length - m[1].length);
  }
  return null;
}

function referenciaDe(lineas: string[], planas: string[]): string | null {
  const etiqueta = /\b(numero|nro\.?|n°|id|codigo) de (operacion|comprobante|referencia|identificacion|transaccion)\b|coelsa id/;
  for (let i = 0; i < planas.length; i++) {
    const m = etiqueta.exec(planas[i]);
    if (!m) continue;
    const candidato = /[A-Z0-9]{6,}/.exec(lineas[i].slice(m.index + m[0].length)) ?? /^[A-Z0-9]{6,}$/.exec(lineas[i + 1] ?? "");
    if (candidato && /\d/.test(candidato[0])) return candidato[0];
  }
  return null;
}

/** ¿El texto nombra al usuario? Solo vale con nombre y apellido: un nombre suelto coincide con cualquiera. */
function nombraA(valor: string | null, nombre: string | null, minimo = 1): boolean {
  const propio = nombre ? palabras(nombre).split(" ").filter(Boolean) : [];
  return propio.length >= minimo && valor !== null && propio.every((palabra) => ` ${palabras(valor)} `.includes(` ${palabra} `));
}

/** Un movimiento interno conserva su dirección, pero como transferencia: no es un gasto ni un ingreso. */
function tipoInterno(signo: Importe["signo"], tipo: Tipo | null): Tipo | null {
  if (signo) return signo === "+" ? "transferencia_recibida" : "transferencia_enviada";
  return tipo === "ingreso" ? "transferencia_recibida" : tipo === "gasto" ? "transferencia_enviada" : tipo;
}

/** Un comprobante: una sola operación, con sus campos repartidos por toda la imagen. */
function leerComprobante(lineas: string[], planas: string[], importes: Importe[], ctx: Contexto): OperacionLeida {
  const todo = planas.join("\n");
  const importe = importes[0];
  const de = campo(lineas, planas, "de|origen|ordenante|remitente");
  const para = campo(lineas, planas, "para|destino");
  const destinatario = campo(lineas, planas, "destinatario|beneficiario");
  const concepto = campo(lineas, planas, "concepto|motivo|descripcion|mensaje");

  // El sentido sale de lo que dice la imagen; si no, de comparar tu nombre con "De" y "Para".
  const sentido: Tipo | null =
    sentidoDe(todo, importe.signo) ??
    (nombraA(para, ctx.nombre) ? "transferencia_recibida" : null) ??
    (nombraA(de, ctx.nombre) || destinatario ? "transferencia_enviada" : null);

  const recibe = sentido === "transferencia_recibida" || sentido === "ingreso";
  const contraparteCruda = recibe ? de : (destinatario ?? para ?? de);
  const contraparte = contraparteCruda && textoUtil(contraparteCruda) ? nombrePropio(textoUtil(contraparteCruda)) : null;
  const motivo = concepto && !/^(varios|sin concepto|-)$/.test(plano(concepto).trim()) ? textoUtil(concepto) : "";

  const rubro = rubroDe(todo);
  // Entre cuentas propias: lo dice el comprobante, o el origen y el destino sos vos.
  const interna = rubro === RUBRO_INTERNO || (nombraA(de, ctx.nombre, 2) && nombraA(destinatario ?? para, ctx.nombre, 2));

  return {
    tipo: interna ? tipoInterno(importe.signo, sentido) : sentido,
    centavos: importe.centavos,
    fecha: noFutura(buscarFecha(todo, ctx.hoy, { abreviados: true })?.fecha, ctx.hoy),
    descripcion: capitalizar([motivo, contraparte].filter(Boolean).join(" · ")),
    contraparte,
    referencia: referenciaDe(lineas, planas),
    importeDudoso: importe.dudoso || new Set(importes.map((i) => i.centavos)).size > 1,
    rubro: interna ? RUBRO_INTERNO : rubro,
    interna,
  };
}

type Contexto = { hoy: string; nombre: string | null };

/**
 * Lee el texto que devolvió el OCR y separa cada operación. Una captura puede ser
 * un comprobante (una operación) o un listado (una por renglón con importe).
 */
export function extraerOperaciones(textoOCR: string, ctx: Contexto): OperacionLeida[] {
  const lineas = textoOCR
    .normalize("NFC")
    .split(/\r?\n/)
    .map((linea) => linea.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const planas = lineas.map(plano);

  // Importes por línea, sin contar saldos ni comisiones (ni el importe suelto debajo de su etiqueta).
  const importes = lineas.map((linea, i) => {
    if (SALDO.test(planas[i])) return [];
    const bajoEtiqueta = i > 0 && SALDO.test(planas[i - 1]) && !lineas[i - 1].includes("$");
    const hallados = importesDe(linea);
    return bajoEtiqueta && hallados.every((h) => !textoUtil(h.resto)) ? [] : hallados;
  });
  const todos = importes.flat();
  if (!todos.length) return [];

  // Es un comprobante si lo dice, o si el mismo importe aparece repetido (el monto y su "Total").
  // Un solo importe sin más señales se lee como un renglón de listado, que conserva el detalle.
  const distintos = new Set(todos.map((i) => i.centavos)).size;
  if (COMPROBANTE.test(planas.join("\n")) || (distintos === 1 && todos.length > 1)) {
    const sinCargos = importes.filter((_, i) => !CARGOS.test(planas[i])).flat();
    return [leerComprobante(lineas, planas, sinCargos.length ? sinCargos : todos, ctx)];
  }

  // ── Listado ──
  const conImporte = importes.map((hallados) => hallados.length > 0);
  const encabezados = planas.map((linea, i) => (conImporte[i] ? null : fechaDeEncabezado(linea, ctx.hoy)));
  const primera = conImporte.indexOf(true);
  const ultima = conImporte.lastIndexOf(true);
  // ¿El texto de cada renglón está arriba o abajo de su importe? Abajo, salvo que la
  // lista termine justo en un importe y empiece con texto antes del primero.
  const textoArriba = ultima === lineas.length - 1 && primera > 0 && encabezados[primera - 1] === null;

  const operaciones: OperacionLeida[] = [];
  let fechaDelGrupo: string | null = null;

  for (let i = 0; i < lineas.length; i++) {
    if (encabezados[i]) fechaDelGrupo = encabezados[i];
    if (!conImporte[i]) continue;

    // Las líneas de texto que acompañan a este importe, hasta el próximo importe o encabezado.
    const vecinas: number[] = [];
    for (let j = i + (textoArriba ? -1 : 1); j >= 0 && j < lineas.length && !conImporte[j] && !encabezados[j]; j += textoArriba ? -1 : 1) {
      vecinas.push(j);
    }

    for (const importe of importes[i]) {
      const textos = [importe.resto, ...vecinas.map((j) => lineas[j])].map(textoUtil).filter(Boolean);
      const bloque = plano(textos.join("\n"));
      // Un renglón dice qué operación es; el otro, con quién o dónde.
      const detalle = textos.find((t) => !esTipoDeOperacion(t)) ?? "";
      const titulo = textos.find(esTipoDeOperacion) ?? "";
      const sentido = sentidoDe(bloque, importe.signo);
      const rubro = rubroDe(bloque);
      const interna = rubro === RUBRO_INTERNO || (rubro === "Transferencias" && nombraA(detalle, ctx.nombre, 2));

      operaciones.push({
        tipo: interna ? tipoInterno(importe.signo, sentido) : sentido,
        centavos: importe.centavos,
        // La fecha del grupo manda: un detalle como "Finde 3-4" no es una fecha.
        fecha: noFutura(fechaDelGrupo ?? buscarFecha(bloque, ctx.hoy, { abreviados: true })?.fecha, ctx.hoy),
        descripcion: capitalizar(nombrePropio(detalle || titulo)),
        contraparte: detalle ? nombrePropio(detalle) : null,
        referencia: null,
        importeDudoso: importe.dudoso,
        rubro: interna ? RUBRO_INTERNO : rubro,
        interna,
      });
    }
  }
  return operaciones;
}
