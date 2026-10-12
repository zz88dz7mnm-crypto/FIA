import { clasificar, type Categoria, type ReglaPersonal } from "./categorias";
import { buscarFecha, buscarPeriodo, type Periodo } from "./fechas";
import { buscarImportes } from "./importes";
import { capitalizar, palabras, plano, quitarTramos, type Tramo } from "./texto";

export type Tipo = "gasto" | "ingreso" | "transferencia_enviada" | "transferencia_recibida";

/** Un movimiento todavía sin guardar. Lo que no se pudo leer queda en null: nunca se inventa. */
export type Borrador = {
  tipo: Tipo | null;
  centavos: number | null;
  categoriaId: string | null;
  descripcion: string;
  fecha: string;
  importeDudoso: boolean;
};

export type OpcionImporte = { centavos: number; descripcion: string };

export type Intencion =
  | {
      clase: "movimiento";
      borrador: Borrador;
      falta: "importe" | "tipo" | null;
      /** Cuando el mensaje trae más de un número, los candidatos a importe. */
      opcionesImporte: OpcionImporte[];
      opcionesTipo: Tipo[];
    }
  | { clase: "resumen"; periodo: Periodo }
  | { clase: "gastos_categoria"; periodo: Periodo; categoriaId: string }
  | { clase: "categoria_desconocida"; buscada: string }
  | { clase: "ultimos" }
  | { clase: "deshacer" }
  | { clase: "ayuda" }
  | { clase: "saludo" }
  | { clase: "gracias" }
  | { clase: "desconocido" };

export type Contexto = { hoy: string; categorias: Categoria[]; reglas: ReglaPersonal[] };

// Verbos y frases admitidos para cada tipo. Se prueban de la más larga a la más corta.
const FRASES_DE_TIPO: [string, Tipo][] = (
  [
    ["transferencia recibida", "transferencia_recibida"],
    ["recibi una transferencia", "transferencia_recibida"],
    ["recibi transferencia", "transferencia_recibida"],
    ["me transfirieron", "transferencia_recibida"],
    ["me transfirio", "transferencia_recibida"],
    ["me pasaron", "transferencia_recibida"],
    ["me mandaron", "transferencia_recibida"],
    ["me enviaron", "transferencia_recibida"],
    ["transferencia enviada", "transferencia_enviada"],
    ["hice una transferencia", "transferencia_enviada"],
    ["le transferi", "transferencia_enviada"],
    ["transferi", "transferencia_enviada"],
    ["le pase", "transferencia_enviada"],
    ["le mande", "transferencia_enviada"],
    ["le envie", "transferencia_enviada"],
    ["mande", "transferencia_enviada"],
    ["envie", "transferencia_enviada"],
    ["me depositaron", "ingreso"],
    ["me ingresaron", "ingreso"],
    ["me pagaron", "ingreso"],
    ["me entraron", "ingreso"],
    ["me entro", "ingreso"],
    ["ingreso", "ingreso"],
    ["cobre", "ingreso"],
    ["gane", "ingreso"],
    ["vendi", "ingreso"],
    ["recibi", "ingreso"],
    ["me cobraron", "gasto"],
    ["me salio", "gasto"],
    ["me costo", "gasto"],
    ["gasto", "gasto"],
    ["gaste", "gasto"],
    ["pague", "gasto"],
    ["compre", "gasto"],
    ["abone", "gasto"],
    ["salio", "gasto"],
    ["costo", "gasto"],
  ] as [string, Tipo][]
).sort((a, b) => b[0].length - a[0].length);

const TRANSFERENCIAS: Tipo[] = ["transferencia_enviada", "transferencia_recibida"];
const GASTO_O_INGRESO: Tipo[] = ["gasto", "ingreso"];

function buscarTipo(textoPlano: string): (Tramo & { tipo: Tipo }) | null {
  for (const [frase, tipo] of FRASES_DE_TIPO) {
    const m = new RegExp(String.raw`\b${frase.replaceAll(" ", String.raw`\s+`)}\b`).exec(textoPlano);
    if (m) return { inicio: m.index, fin: m.index + m[0].length, tipo };
  }
  return null;
}

const RELLENO_INICIO = /^(en|de|del|por|para|a|al|el|la|los|las|un|una|unos|unas|pesos|con|y|que)\s+/i;
const RELLENO_FIN = /\s+(en|de|del|por|para|a|al|el|la|pesos|con|y)$/i;
const SOLO_RELLENO = /^(en|de|del|por|para|a|al|el|la|los|las|un|una|pesos|con|y|que)$/i;
const BORDES = /^[\s,.;:¿?¡!\-–]+|[\s,.;:¿?¡!\-–]+$/g;

function limpiarDescripcion(texto: string): string {
  let t = texto.replace(/\$/g, " ").replace(/\s+/g, " ").replace(BORDES, "");
  for (let anterior = ""; anterior !== t; ) {
    anterior = t;
    t = t.replace(RELLENO_INICIO, "").replace(RELLENO_FIN, "").replace(BORDES, "");
  }
  return SOLO_RELLENO.test(t) ? "" : capitalizar(t);
}

/** La única categoría de ingresos, si hay exactamente una. */
function categoriaDeIngresos(categorias: Categoria[]): Categoria | null {
  const ingresos = categorias.filter((c) => c.clase === "ingreso");
  return ingresos.length === 1 ? ingresos[0] : null;
}

function armarMovimiento(
  partes: { tipo: Tipo | null; transferenciaSinSentido: boolean; fecha: string },
  importes: { centavos: number; dudoso: boolean; descripcion: string }[],
  descripcionBase: string,
  textoCategoria: string,
  ctx: Contexto,
): Intencion {
  const unico = importes.length === 1 ? importes[0] : null;
  const descripcion = unico ? unico.descripcion : descripcionBase;
  const categoria = clasificar(textoCategoria || descripcion, ctx.categorias, ctx.reglas);

  let tipo = partes.tipo;
  if (!tipo && !partes.transferenciaSinSentido && categoria) tipo = categoria.clase;

  let categoriaId = categoria?.id ?? null;
  if (!categoriaId && tipo === "ingreso") categoriaId = categoriaDeIngresos(ctx.categorias)?.id ?? null;

  return {
    clase: "movimiento",
    borrador: {
      tipo,
      centavos: unico?.centavos ?? null,
      categoriaId,
      descripcion,
      fecha: partes.fecha,
      importeDudoso: unico?.dudoso ?? false,
    },
    falta: !unico ? "importe" : !tipo ? "tipo" : null,
    opcionesImporte: importes.length > 1 ? importes.map(({ centavos, descripcion: d }) => ({ centavos, descripcion: d })) : [],
    opcionesTipo: partes.transferenciaSinSentido ? TRANSFERENCIAS : GASTO_O_INGRESO,
  };
}

/** Formato con punto y coma: "gasto; 4500; comida; almuerzo". */
function interpretarFormal(campos: string[], ctx: Contexto): Intencion | null {
  const cabeza = palabras(campos[0]);

  if (cabeza === "gastos") {
    const categoria = clasificar(campos[1] ?? "", ctx.categorias, ctx.reglas);
    if (!categoria) return { clase: "categoria_desconocida", buscada: (campos[1] ?? "").trim() };
    return { clase: "gastos_categoria", categoriaId: categoria.id, periodo: buscarPeriodo(plano(campos.slice(2).join(" "))) };
  }

  const tipo = buscarTipo(plano(campos[0]));
  if (!tipo || tipo.fin - tipo.inicio !== campos[0].trim().length) return null;

  const hallados = buscarImportes(plano(campos[1] ?? ""));
  const resto = campos.slice(2).map((c) => c.trim()).filter(Boolean);
  const fecha = buscarFecha(plano(resto.join(" ; ")), ctx.hoy);
  const sinFecha = fecha ? resto.filter((c) => !buscarFecha(plano(c), ctx.hoy)) : resto;
  // Con dos campos, el primero es la categoría y el segundo la descripción.
  const descripcion = limpiarDescripcion(sinFecha.length > 1 ? sinFecha.slice(1).join(" ") : (sinFecha[0] ?? ""));

  return armarMovimiento(
    { tipo: tipo.tipo, transferenciaSinSentido: false, fecha: fecha?.fecha ?? ctx.hoy },
    hallados.slice(0, 1).map((i) => ({ centavos: i.centavos, dudoso: i.dudoso, descripcion })),
    descripcion,
    sinFecha.join(" "),
    ctx,
  );
}

/** Convierte un mensaje en una intención, usando solo reglas explícitas. */
export function interpretar(mensaje: string, ctx: Contexto): Intencion {
  const original = mensaje.normalize("NFC").trim();
  if (!original) return { clase: "desconocido" };

  if (original.includes(";")) {
    const formal = interpretarFormal(original.split(";"), ctx);
    if (formal) return formal;
  }

  const texto = original.replaceAll(";", " ");
  const p = plano(texto);
  const limpio = palabras(texto);

  const fecha = buscarFecha(p, ctx.hoy);
  const sinFecha = fecha ? p.slice(0, fecha.inicio) + " ".repeat(fecha.fin - fecha.inicio) + p.slice(fecha.fin) : p;
  const importes = buscarImportes(sinFecha);

  // ── Comandos y consultas ──
  if (/^(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|ey|che)( fia)?$/.test(limpio)) {
    return { clase: "saludo" };
  }
  if (/^(muchas |mil )?gracias( fia)?$/.test(limpio)) return { clase: "gracias" };
  if (/^(ayuda|como funciona|como se usa|como te uso|que podes hacer|que puedo hacer|comandos)\b/.test(limpio) || texto === "?") {
    return { clase: "ayuda" };
  }
  if (/^(deshacer|me equivoque)$/.test(limpio) || /^(deshace|deshacer|anula|anular|borra|borrar|elimina|eliminar)\b.*\bultimo\b/.test(limpio)) {
    return { clase: "deshacer" };
  }
  if (/^(ultimos|ultimas|movimientos|historial|que anote|que cargue|ver movimientos)\b/.test(limpio)) {
    return { clase: "ultimos" };
  }
  if (/^(resumen|balance|como vengo|como voy|como estoy)\b/.test(limpio)) {
    return { clase: "resumen", periodo: buscarPeriodo(p) };
  }
  if (!importes.length && /^(cuanto (gaste|llevo|gasto|vengo)|gastos? (de|del|en)\b)/.test(limpio)) {
    const categoria = clasificar(texto, ctx.categorias, ctx.reglas);
    return categoria
      ? { clase: "gastos_categoria", categoriaId: categoria.id, periodo: buscarPeriodo(p) }
      : { clase: "resumen", periodo: buscarPeriodo(p) };
  }

  // ── Movimientos ──
  const tipo = buscarTipo(sinFecha);
  const transferenciaSinSentido = !tipo && /\btransferencias?\b/.test(p);
  const fijos: Tramo[] = [tipo, fecha].filter((t): t is NonNullable<typeof t> => t !== null);
  const describir = (extra: Tramo[]) =>
    limpiarDescripcion(quitarTramos(texto, [...fijos, ...extra]).replace(/\btransferencias?\b/gi, " "));

  const descripcionBase = describir([]);
  const candidatos = importes.map((i) => ({ centavos: i.centavos, dudoso: i.dudoso, descripcion: describir([i]) }));
  const hayCategoria = clasificar(descripcionBase, ctx.categorias, ctx.reglas) !== null;

  if (!importes.length && !tipo && !transferenciaSinSentido && !hayCategoria) return { clase: "desconocido" };

  return armarMovimiento(
    { tipo: tipo?.tipo ?? null, transferenciaSinSentido, fecha: fecha?.fecha ?? ctx.hoy },
    candidatos,
    descripcionBase,
    "",
    ctx,
  );
}

/**
 * Lee la respuesta a una pregunta de Fia ("¿Cuánto fue?", "¿Gasto o ingreso?").
 * Devuelve el borrador completado, o null si el mensaje no responde la pregunta.
 */
export function completar(borrador: Borrador, falta: "importe" | "tipo", respuesta: string): Borrador | null {
  const p = plano(respuesta.normalize("NFC"));

  if (falta === "importe") {
    const importes = buscarImportes(p);
    if (importes.length !== 1) return null;
    const sobra = palabras(quitarTramos(p, [importes[0]]).replace(/\$/g, " ")).replace(/\b(fueron|fue|son|eran|pesos)\b/g, "").trim();
    if (sobra) return null;
    return { ...borrador, centavos: importes[0].centavos, importeDudoso: importes[0].dudoso };
  }

  if (buscarImportes(p).length) return null;
  const limpio = palabras(p);
  const tipo: Tipo | null =
    /^(un |es un |fue un )?(gasto)$/.test(limpio) ? "gasto"
    : /^(un |es un |fue un )?(ingreso)$/.test(limpio) ? "ingreso"
    : /^(la )?(envie|enviada|mande|hice)( yo)?$/.test(limpio) ? "transferencia_enviada"
    : /^(la )?(recibi|recibida)$|^me (la )?(mandaron|enviaron|hicieron)$/.test(limpio) ? "transferencia_recibida"
    : null;
  return tipo ? { ...borrador, tipo } : null;
}
