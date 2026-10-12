import type { Repositorio, CambiosTransaccion } from "../datos/repositorio";
import type { Categoria, ReglaPersonal } from "../motor/categorias";
import { rangoDe, type Periodo } from "../motor/fechas";
import { completar, interpretar, type Borrador, type Intencion, type Tipo } from "../motor/interpretar";
import { capitalizar, palabras } from "../motor/texto";
import { ES_ENTRADA, type DatosMensaje, type Mensaje, type Perfil, type Resumen, type Transaccion } from "../tipos";
import { voz } from "./voz";

export type Sesion = {
  repo: Repositorio;
  perfil: Perfil;
  categorias: Categoria[];
  reglas: ReglaPersonal[];
  /** Fecha de hoy ("AAAA-MM-DD") en la zona horaria del usuario. */
  hoy: () => string;
};

/** Lo que cambió después de una acción: mensajes nuevos de Fia y movimientos tocados. */
export type Novedad = { mensajes: Mensaje[]; transacciones: Transaccion[] };

type MovimientoLeido = Extract<Intencion, { clase: "movimiento" }>;

const MENSAJES_A_CARGAR = 80;

export function hoyEn(zonaHoraria: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function idsEnMensajes(mensajes: Mensaje[]): string[] {
  return mensajes.flatMap((m) =>
    m.datos.clase === "propuesta" ? [m.datos.transaccionId] : m.datos.clase === "lista" ? m.datos.transaccionIds : [],
  );
}

/** Carga todo lo necesario para conversar. La primera vez, Fia se presenta. */
export async function abrir(repo: Repositorio): Promise<{ sesion: Sesion; mensajes: Mensaje[]; transacciones: Transaccion[] }> {
  const [perfil, categorias, reglas, previos] = await Promise.all([
    repo.perfil(),
    repo.categorias(),
    repo.reglas(),
    repo.mensajes(MENSAJES_A_CARGAR),
  ]);
  const sesion: Sesion = { repo, perfil, categorias, reglas, hoy: () => hoyEn(perfil.zonaHoraria) };

  const mensajes = previos.length
    ? previos
    : [
        perfil.nombre
          ? await decir(sesion, voz.saludo(perfil.nombre))
          : await decir(sesion, voz.bienvenida, { clase: "pide_nombre" }),
      ];
  return { sesion, mensajes, transacciones: await repo.transaccionesPorId(idsEnMensajes(mensajes)) };
}

function decir(sesion: Sesion, texto: string, datos: DatosMensaje = { clase: "texto" }): Promise<Mensaje> {
  return sesion.repo.agregarMensaje({ autor: "fia", texto, datos });
}

function leerNombre(texto: string, sesion: Sesion): string | null {
  const limpio = texto
    .trim()
    .replace(/^(me llamo|me dicen|soy|decime|llamame)\s+/i, "")
    .replace(/[.!¡]+$/g, "")
    .trim();
  const pareceNombre = limpio.length > 0 && limpio.length <= 30 && !/\d/.test(limpio) && limpio.split(/\s+/).length <= 3;
  if (!pareceNombre) return null;
  const leido = interpretar(texto, { hoy: sesion.hoy(), categorias: sesion.categorias, reglas: sesion.reglas });
  return leido.clase === "desconocido" ? capitalizar(limpio) : null;
}

function nombreDeCategoria(sesion: Sesion, id: string | null): string | null {
  return sesion.categorias.find((c) => c.id === id)?.nombre ?? null;
}

async function resumir(sesion: Sesion, periodo: Periodo): Promise<Resumen & { cantidad: number }> {
  const { desde, hasta } = rangoDe(periodo, sesion.hoy());
  const transacciones = await sesion.repo.confirmadasEntre(desde, hasta);

  let entradas = 0;
  let salidas = 0;
  const grupos = new Map<string, number>();
  for (const t of transacciones) {
    if (ES_ENTRADA[t.tipo]) {
      entradas += t.centavos;
    } else {
      salidas += t.centavos;
      const nombre = nombreDeCategoria(sesion, t.categoriaId) ?? "Sin clasificar";
      grupos.set(nombre, (grupos.get(nombre) ?? 0) + t.centavos);
    }
  }
  const porCategoria = [...grupos].map(([nombre, centavos]) => ({ nombre, centavos })).sort((a, b) => b.centavos - a.centavos);
  return { periodo, desde, entradas, salidas, porCategoria, cantidad: transacciones.length };
}

/** Guarda el movimiento "en revisión" y lo muestra para confirmar. Avisa si parece repetido. */
async function proponer(sesion: Sesion, borrador: Borrador & { tipo: Tipo; centavos: number }, origenMensajeId: string): Promise<Novedad> {
  // Repetido = mismo tipo, importe, día y detalle. Dos gastos distintos que cuestan igual no avisan.
  const detalle = palabras(borrador.descripcion);
  const repetidas = (await sesion.repo.parecidas(borrador)).filter((otra) => palabras(otra.descripcion) === detalle);
  const transaccion = await sesion.repo.crearTransaccion({
    tipo: borrador.tipo,
    centavos: borrador.centavos,
    fecha: borrador.fecha,
    descripcion: borrador.descripcion,
    categoriaId: borrador.categoriaId,
    origenMensajeId,
  });

  const [texto, aviso] = repetidas.length
    ? ([voz.propuestaDuplicada, "duplicado"] as const)
    : borrador.importeDudoso
      ? ([voz.propuestaDudosa(borrador.centavos), "importe_dudoso"] as const)
      : ([voz.propuesta, undefined] as const);

  const mensaje = await decir(sesion, texto, { clase: "propuesta", transaccionId: transaccion.id, ...(aviso && { aviso }) });
  return { mensajes: [mensaje], transacciones: [transaccion] };
}

/** Si al borrador le falta algo, lo pregunta; si está completo, lo propone. */
async function avanzar(sesion: Sesion, leido: Omit<MovimientoLeido, "clase" | "falta">, origenMensajeId: string): Promise<Novedad> {
  const { borrador, opcionesImporte, opcionesTipo } = leido;

  if (borrador.centavos !== null && borrador.tipo !== null) {
    return proponer(sesion, { ...borrador, tipo: borrador.tipo, centavos: borrador.centavos }, origenMensajeId);
  }

  const falta = borrador.centavos === null ? "importe" : "tipo";
  const texto =
    falta === "importe"
      ? opcionesImporte.length
        ? voz.pideImporteEntreVarios
        : voz.pideImporte
      : opcionesTipo.includes("gasto")
        ? voz.pideTipo
        : voz.pideSentido;

  const mensaje = await decir(sesion, texto, { clase: "pregunta", falta, borrador, opcionesImporte, opcionesTipo, origenMensajeId });
  return { mensajes: [mensaje], transacciones: [] };
}

/**
 * Procesa un mensaje del usuario. `anterior` es el último mensaje de Fia: si era
 * una pregunta, primero se intenta leer el texto como su respuesta.
 */
export async function recibir(sesion: Sesion, texto: string, anterior: Mensaje | null): Promise<Novedad & { propio: Mensaje }> {
  const propio = await sesion.repo.agregarMensaje({ autor: "usuario", texto });
  return { propio, ...(await responder(sesion, texto, anterior, propio.id)) };
}

async function responder(sesion: Sesion, texto: string, anterior: Mensaje | null, propioId: string): Promise<Novedad> {
  const soloTexto = async (t: string, datos?: DatosMensaje): Promise<Novedad> => ({
    mensajes: [await decir(sesion, t, datos)],
    transacciones: [],
  });

  if (anterior?.datos.clase === "pide_nombre") {
    const nombre = leerNombre(texto, sesion);
    if (nombre) {
      await sesion.repo.guardarNombre(nombre);
      sesion.perfil.nombre = nombre;
      return soloTexto(voz.gusto(nombre), { clase: "ejemplos" });
    }
  }

  if (anterior?.datos.clase === "pregunta") {
    const pregunta = anterior.datos;
    let completo = completar(pregunta.borrador, pregunta.falta, texto);
    if (completo && pregunta.falta === "importe") {
      // Con varios números en el mensaje original, cada opción trae su propia descripción.
      const opcion = pregunta.opcionesImporte.find((o) => o.centavos === completo!.centavos);
      if (opcion) completo = { ...completo, descripcion: opcion.descripcion };
    }
    if (completo) {
      return avanzar(sesion, { borrador: completo, opcionesImporte: [], opcionesTipo: pregunta.opcionesTipo }, pregunta.origenMensajeId);
    }
  }

  const leido = interpretar(texto, { hoy: sesion.hoy(), categorias: sesion.categorias, reglas: sesion.reglas });

  switch (leido.clase) {
    case "movimiento":
      return avanzar(sesion, leido, propioId);

    case "resumen": {
      const { cantidad, ...resumen } = await resumir(sesion, leido.periodo);
      if (!cantidad) return soloTexto(voz.resumenVacio(resumen.periodo, resumen.desde));
      const enRojo = resumen.entradas > 0 && resumen.salidas > resumen.entradas;
      return soloTexto(enRojo ? voz.resumenEnRojo : voz.resumen, { clase: "resumen", resumen });
    }

    case "gastos_categoria": {
      const { desde, hasta } = rangoDe(leido.periodo, sesion.hoy());
      const gastos = (await sesion.repo.confirmadasEntre(desde, hasta)).filter(
        (t) => !ES_ENTRADA[t.tipo] && t.categoriaId === leido.categoriaId,
      );
      const total = gastos.reduce((suma, t) => suma + t.centavos, 0);
      const nombre = nombreDeCategoria(sesion, leido.categoriaId) ?? "esa categoría";
      return soloTexto(voz.gastosDeCategoria(nombre, total, gastos.length, leido.periodo, desde));
    }

    case "categoria_desconocida":
      return soloTexto(voz.categoriaDesconocida(leido.buscada));

    case "ultimos": {
      const ultimas = await sesion.repo.ultimas(5);
      if (!ultimas.length) return soloTexto(voz.ultimosVacio, { clase: "ejemplos" });
      const mensaje = await decir(sesion, voz.ultimos, { clase: "lista", transaccionIds: ultimas.map((t) => t.id) });
      return { mensajes: [mensaje], transacciones: ultimas };
    }

    case "deshacer": {
      const [ultima] = await sesion.repo.ultimas(1);
      if (!ultima) return soloTexto(voz.deshacerVacio);
      const mensaje = await decir(sesion, voz.deshacer, { clase: "propuesta", transaccionId: ultima.id });
      return { mensajes: [mensaje], transacciones: [ultima] };
    }

    case "saludo":
      return soloTexto(voz.saludo(sesion.perfil.nombre));
    case "gracias":
      return soloTexto(voz.gracias);
    case "ayuda":
      return soloTexto(voz.ayuda, { clase: "ejemplos" });
    case "desconocido":
      return soloTexto(voz.noLoLei, { clase: "ejemplos" });
  }
}

/** Qué dice Fia al anotar: aprovecha para contar cómo viene el mes. */
async function fraseDeAnotado(sesion: Sesion, t: Transaccion): Promise<string> {
  const hoy = sesion.hoy();
  const mes = rangoDe("mes", hoy);
  if (t.fecha < mes.desde || t.fecha > mes.hasta) return voz.anotadoConFecha(t.fecha, hoy);

  if (t.tipo === "gasto") {
    const categoria = nombreDeCategoria(sesion, t.categoriaId);
    if (!categoria) return voz.anotadoSinCategoria;
    const delMes = await sesion.repo.confirmadasEntre(mes.desde, mes.hasta);
    const total = delMes
      .filter((otra) => !ES_ENTRADA[otra.tipo] && otra.categoriaId === t.categoriaId)
      .reduce((suma, otra) => suma + otra.centavos, 0);
    return voz.anotadoEnCategoria(total, categoria);
  }
  if (t.tipo === "ingreso") {
    const delMes = await sesion.repo.confirmadasEntre(mes.desde, mes.hasta);
    return voz.anotadoIngreso(delMes.filter((otra) => ES_ENTRADA[otra.tipo]).reduce((suma, otra) => suma + otra.centavos, 0));
  }
  return voz.anotado;
}

async function cambiar(sesion: Sesion, id: string, cambios: CambiosTransaccion, frase: (t: Transaccion) => Promise<string> | string): Promise<Novedad> {
  const transaccion = await sesion.repo.actualizarTransaccion(id, cambios);
  return { mensajes: [await decir(sesion, await frase(transaccion))], transacciones: [transaccion] };
}

/** El usuario aprueba un movimiento: recién ahí cuenta en los totales. */
export function confirmar(sesion: Sesion, id: string): Promise<Novedad> {
  return cambiar(sesion, id, { estado: "confirmada" }, (t) => fraseDeAnotado(sesion, t));
}

/** Guarda las correcciones del usuario y deja el movimiento confirmado. */
export function editar(sesion: Sesion, id: string, cambios: Omit<CambiosTransaccion, "estado">, yaAnotado = false): Promise<Novedad> {
  return cambiar(sesion, id, { ...cambios, estado: "confirmada" }, (t) => (yaAnotado ? voz.guardado : fraseDeAnotado(sesion, t)));
}

export function descartar(sesion: Sesion, id: string): Promise<Novedad> {
  return cambiar(sesion, id, { estado: "rechazada" }, () => voz.descartado);
}

/** Saca de los totales un movimiento ya anotado. No se borra: queda en el historial. */
export function anular(sesion: Sesion, id: string): Promise<Novedad> {
  return cambiar(sesion, id, { estado: "anulada" }, () => voz.anulado);
}
