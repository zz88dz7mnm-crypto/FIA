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
  /** Frasco del que se descuenta el gasto, si el mensaje nombra uno. */
  frascoId: string | null;
};

/** Un frasco, tal como lo necesita el motor para reconocerlo por su nombre. */
export type FrascoConocido = { id: string; nombre: string };

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
  | { clase: "frascos" }
  /** Poner o sacar plata de un frasco (lo crea si no existe). `centavos` negativo = sacar; null = sin importe. */
  | { clase: "frasco_asignar"; nombre: string; frascoId: string | null; centavos: number | null }
  | { clase: "frasco_borrar"; nombre: string; frascoId: string | null }
  /** "/borrar-todo": borrar todo lo del mes en curso. Siempre pide confirmación. */
  | { clase: "borrar_mes" }
  | { clase: "ultimos" }
  | { clase: "deshacer" }
  | { clase: "ayuda" }
  | { clase: "saludo" }
  | { clase: "gracias" }
  | { clase: "desconocido" };

export type Contexto = { hoy: string; categorias: Categoria[]; reglas: ReglaPersonal[]; frascos: FrascoConocido[] };

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
  let t = texto
    .replace(/\$/g, " ")
    .replace(/\b(del|de|en el|con el|al|el)?\s*frasco\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(BORDES, "");
  for (let anterior = ""; anterior !== t; ) {
    anterior = t;
    t = t.replace(RELLENO_INICIO, "").replace(RELLENO_FIN, "").replace(BORDES, "");
  }
  return SOLO_RELLENO.test(t) ? "" : capitalizar(t);
}

/** El frasco cuyo nombre aparece en el texto como palabras enteras; si hay varios, el de nombre más largo. */
export function buscarFrasco(texto: string, frascos: FrascoConocido[]): FrascoConocido | null {
  const buscable = ` ${palabras(texto)} `;
  const hallados = frascos.filter((f) => palabras(f.nombre) && buscable.includes(` ${palabras(f.nombre)} `));
  return hallados.sort((a, b) => b.nombre.length - a.nombre.length)[0] ?? null;
}

// Palabras que rodean al nombre de un frasco en una orden y no forman parte de él.
const RELLENO_DE_FRASCO = new Set(
  `frasco frascos yo le crea crear creame arma armar armame abri abrir nuevo nueva pone poner ponele mete meter metele
   suma sumar sumale agrega agregar agregale carga cargar cargale asigno asigna asignar asignale designo designa designar
   destino destina destinar destinale separo separa separar aparto aparta apartar saca sacar sacale saque quita quitar
   quitale resta restar restale retira retirar retiro borra borrar borrame elimina eliminar cerra cerrar
   en el la los las al a de del para con pesos un una mi mis gastos gasto cosas plata`.split(/\s+/),
);
const SACAR_DE_FRASCO = /\b(saca|sacar|sacale|saque|quita|quitar|quitale|resta|restar|restale|retira|retirar|retiro)\b/;
const BORRAR_FRASCO = /^(borra|borrar|borrame|elimina|eliminar|cerra|cerrar)\b/;
const ASIGNAR = /^(yo )?(asigno|asigna|asignale|designo|designa|destino|destina|destinale|separo|separa|aparto|aparta)\b/;

/** El nombre del frasco dentro de una orden: lo que queda al sacar el relleno de las puntas. */
function nombreDeFrasco(texto: string): string {
  const piezas = texto.replace(/[$.,;:¿?¡!"«»]/g, " ").split(/\s+/).filter(Boolean);
  const esRelleno = (pieza: string) => RELLENO_DE_FRASCO.has(plano(pieza));
  while (piezas.length && esRelleno(piezas[0])) piezas.shift();
  while (piezas.length && esRelleno(piezas.at(-1)!)) piezas.pop();
  return capitalizar(piezas.join(" "));
}

/** Órdenes sobre frascos: "frasco facu 20000", "sacá 5000 del frasco facu", "borrá el frasco facu". */
function interpretarFrasco(texto: string, limpio: string, importes: ReturnType<typeof buscarImportes>, ctx: Contexto): Intencion | null {
  const nombre = nombreDeFrasco(importes.length ? quitarTramos(texto, [importes[0]]) : texto);
  const existente = ctx.frascos.find((f) => palabras(f.nombre) === palabras(nombre)) ?? null;

  if (BORRAR_FRASCO.test(limpio) && !importes.length) {
    return { clase: "frasco_borrar", nombre, frascoId: existente?.id ?? null };
  }
  // "apuntes 3000 frasco facu": nombra un frasco que ya existe y agrega algo más → es un gasto de ese frasco.
  if (!existente && importes.length && buscarFrasco(nombre, ctx.frascos)) return null;

  const centavos = importes[0]?.centavos ?? null;
  return {
    clase: "frasco_asignar",
    nombre: existente?.nombre ?? nombre,
    frascoId: existente?.id ?? null,
    centavos: centavos !== null && SACAR_DE_FRASCO.test(limpio) ? -centavos : centavos,
  };
}

/** La categoría general de ingresos: la que se llama "Ingresos" o, si no, la única de esa clase. */
export function categoriaDeIngresos(categorias: Categoria[]): Categoria | null {
  const ingresos = categorias.filter((c) => c.clase === "ingreso");
  return ingresos.find((c) => palabras(c.nombre) === "ingresos") ?? (ingresos.length === 1 ? ingresos[0] : null);
}

function armarMovimiento(
  partes: { tipo: Tipo | null; transferenciaSinSentido: boolean; fecha: string; frascoId: string | null },
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
      frascoId: tipo === "ingreso" || tipo === "transferencia_recibida" ? null : partes.frascoId,
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
    { tipo: tipo.tipo, transferenciaSinSentido: false, fecha: fecha?.fecha ?? ctx.hoy, frascoId: buscarFrasco(campos.join(" "), ctx.frascos)?.id ?? null },
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

  // Borrar es grave: solo se acepta el comando exacto, nunca una frase parecida.
  if (/^\/borrar[- ]todo$/i.test(original)) return { clase: "borrar_mes" };

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

  // ── Frascos ──
  const tipo = buscarTipo(sinFecha);
  if (/^(mis |ver |los )?frascos$|^como (estan|vienen|van) (los |mis )?frascos$/.test(limpio)) return { clase: "frascos" };
  if (!tipo && (/\bfrascos?\b/.test(p) || ASIGNAR.test(limpio))) {
    const orden = interpretarFrasco(texto, limpio, importes, ctx);
    if (orden) return orden;
  }

  // ── Movimientos ──
  const transferenciaSinSentido = !tipo && /\btransferencias?\b/.test(p);
  const fijos: Tramo[] = [tipo, fecha].filter((t): t is NonNullable<typeof t> => t !== null);
  const describir = (extra: Tramo[]) =>
    limpiarDescripcion(quitarTramos(texto, [...fijos, ...extra]).replace(/\btransferencias?\b/gi, " "));

  const descripcionBase = describir([]);
  const candidatos = importes.map((i) => ({ centavos: i.centavos, dudoso: i.dudoso, descripcion: describir([i]) }));
  const hayCategoria = clasificar(descripcionBase, ctx.categorias, ctx.reglas) !== null;

  if (!importes.length && !tipo && !transferenciaSinSentido && !hayCategoria) return { clase: "desconocido" };

  return armarMovimiento(
    { tipo: tipo?.tipo ?? null, transferenciaSinSentido, fecha: fecha?.fecha ?? ctx.hoy, frascoId: buscarFrasco(texto, ctx.frascos)?.id ?? null },
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
