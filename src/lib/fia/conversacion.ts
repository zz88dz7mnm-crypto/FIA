import type { Repositorio, CambiosTransaccion } from "../datos/repositorio";
import { extraerOperaciones } from "../motor/capturas";
import { clasificar, type Categoria, type ReglaPersonal } from "../motor/categorias";
import { nombreDeMes, rangoDe, type Periodo } from "../motor/fechas";
import { buscarFrasco, categoriaDeIngresos, completar, interpretar, type Borrador, type Contexto, type Intencion, type Tipo } from "../motor/interpretar";
import { capitalizar, palabras } from "../motor/texto";
import { ES_ENTRADA, type Aviso, type DatosMensaje, type EstadoFrasco, type Mensaje, type Perfil, type Resumen, type Transaccion } from "../tipos";
import { voz } from "./voz";

export type Sesion = {
  repo: Repositorio;
  perfil: Perfil;
  categorias: Categoria[];
  reglas: ReglaPersonal[];
  frascos: EstadoFrasco[];
  /** Fecha de hoy ("AAAA-MM-DD") en la zona horaria del usuario. */
  hoy: () => string;
};

/**
 * Lo que cambió después de una acción: mensajes nuevos de Fia y movimientos tocados.
 * `recargar` avisa que se borraron cosas y hay que volver a leer el chat entero.
 */
export type Novedad = { mensajes: Mensaje[]; transacciones: Transaccion[]; recargar?: boolean };

type MovimientoLeido = Extract<Intencion, { clase: "movimiento" }>;

const MENSAJES_A_CARGAR = 80;

export function hoyEn(zonaHoraria: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function idsEnMensajes(mensajes: Mensaje[]): string[] {
  return mensajes.flatMap((m) =>
    m.datos.clase === "propuesta"
      ? [m.datos.transaccionId]
      : m.datos.clase === "lista" || m.datos.clase === "lote"
        ? m.datos.transaccionIds
        : [],
  );
}

function contexto(sesion: Sesion): Contexto {
  return { hoy: sesion.hoy(), categorias: sesion.categorias, reglas: sesion.reglas, frascos: sesion.frascos };
}

/** Carga todo lo necesario para conversar. La primera vez, Fia se presenta. */
export async function abrir(repo: Repositorio): Promise<{ sesion: Sesion; mensajes: Mensaje[]; transacciones: Transaccion[] }> {
  const [perfil, categorias, reglas, frascos, previos] = await Promise.all([
    repo.perfil(),
    repo.categorias(),
    repo.reglas(),
    repo.frascos(),
    repo.mensajes(MENSAJES_A_CARGAR),
  ]);
  const sesion: Sesion = { repo, perfil, categorias, reglas, frascos, hoy: () => hoyEn(perfil.zonaHoraria) };

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
  return interpretar(texto, contexto(sesion)).clase === "desconocido" ? capitalizar(limpio) : null;
}

/** Una categoría buscada por su nombre exacto (sin distinguir mayúsculas ni acentos). */
function categoriaLlamada(sesion: Sesion, nombre: string | null): Categoria | null {
  return (nombre && sesion.categorias.find((c) => palabras(c.nombre) === palabras(nombre))) || null;
}

const esTransferencia = (tipo: Tipo) => tipo === "transferencia_enviada" || tipo === "transferencia_recibida";

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
    // Una transferencia sin otra categoría va a "Transferencias", y su detalle es con quién fue.
    categoriaId: borrador.categoriaId ?? (esTransferencia(borrador.tipo) ? (categoriaLlamada(sesion, "Transferencias")?.id ?? null) : null),
    contraparte: esTransferencia(borrador.tipo) && borrador.descripcion ? borrador.descripcion : null,
    frascoId: borrador.frascoId,
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

  if (anterior?.datos.clase === "confirmar_borrado") {
    const respuesta = palabras(texto);
    if (/^si\b/.test(respuesta)) {
      const { desde, hasta } = anterior.datos;
      const { movimientos } = await sesion.repo.borrarMes(desde, hasta);
      await refrescarFrascos(sesion);
      return { ...(await soloTexto(voz.mesBorrado(nombreDeMes(desde), movimientos))), recargar: true };
    }
    if (/^no\b/.test(respuesta)) return soloTexto(voz.borradoCancelado);
  }

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

  const leido = interpretar(texto, contexto(sesion));

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

    case "frascos":
      await refrescarFrascos(sesion);
      return sesion.frascos.length
        ? soloTexto(voz.frascos, { clase: "frascos", frascos: sesion.frascos })
        : soloTexto(voz.frascosVacio);

    case "frasco_asignar": {
      if (!leido.nombre) return soloTexto(voz.frascoSinNombre);
      const { centavos } = leido;
      if (!leido.frascoId && centavos !== null && centavos < 0) return soloTexto(voz.frascoNoExiste(leido.nombre));

      const id = leido.frascoId ?? (await sesion.repo.crearFrasco(leido.nombre)).id;
      if (centavos) await sesion.repo.aportarAFrasco(id, centavos);
      await refrescarFrascos(sesion);

      const texto = !leido.frascoId
        ? voz.frascoCreado(leido.nombre, centavos)
        : !centavos
          ? voz.frascoEstado(leido.nombre)
          : centavos > 0
            ? voz.frascoSumado(leido.nombre, centavos)
            : voz.frascoRestado(leido.nombre, -centavos);
      return soloTexto(texto, { clase: "frascos", frascos: sesion.frascos.filter((f) => f.id === id) });
    }

    case "borrar_mes": {
      const { desde, hasta } = rangoDe("mes", sesion.hoy());
      const cantidad = (await sesion.repo.movimientosEntre(desde, hasta)).length;
      return soloTexto(voz.borrarMesPregunta(nombreDeMes(desde), cantidad), { clase: "confirmar_borrado", desde, hasta });
    }

    case "frasco_borrar": {
      if (!leido.frascoId) return soloTexto(leido.nombre ? voz.frascoNoExiste(leido.nombre) : voz.frascoSinNombre);
      await sesion.repo.borrarFrasco(leido.frascoId);
      await refrescarFrascos(sesion);
      return soloTexto(voz.frascoBorrado(leido.nombre));
    }

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
  const frasco = ES_ENTRADA[t.tipo] ? undefined : sesion.frascos.find((f) => f.id === t.frascoId);
  if (frasco) return voz.anotadoEnFrasco(frasco.nombre, frasco.asignado - frasco.gastado);
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
  // Si el movimiento toca un frasco, sus cuentas cambiaron.
  if (transaccion.frascoId || "frascoId" in cambios) await refrescarFrascos(sesion);
  return { mensajes: [await decir(sesion, await frase(transaccion))], transacciones: [transaccion] };
}

async function refrescarFrascos(sesion: Sesion): Promise<void> {
  sesion.frascos = await sesion.repo.frascos();
}

/**
 * Procesa el texto leído de una captura: guarda cada operación "en revisión" y las
 * muestra para confirmar, editar o descartar una por una.
 */
export async function recibirCaptura(sesion: Sesion, textoLeido: string): Promise<Novedad & { propio: Mensaje }> {
  const propio = await sesion.repo.agregarMensaje({ autor: "usuario", texto: "", datos: { clase: "captura" }, textoExtraido: textoLeido });
  const hoy = sesion.hoy();
  const operaciones = extraerOperaciones(textoLeido, { hoy, nombre: sesion.perfil.nombre });
  if (!operaciones.length) return { propio, mensajes: [await decir(sesion, voz.capturaVacia)], transacciones: [] };

  const transacciones: Transaccion[] = [];
  const avisos: Record<string, Aviso[]> = {};
  for (const operacion of operaciones) {
    // Sin sentido claro se guarda como enviada, pero el ticket obliga a elegir antes de anotar.
    const tipo = operacion.tipo ?? "transferencia_enviada";
    const fecha = operacion.fecha ?? hoy;
    // Primero el tipo de operación que dice la captura; si no dice nada, las palabras del detalle.
    const categoria =
      categoriaLlamada(sesion, operacion.rubro) ??
      clasificar(operacion.descripcion, sesion.categorias, sesion.reglas) ??
      (tipo === "ingreso" ? categoriaDeIngresos(sesion.categorias) : null);
    const detalle = palabras(operacion.descripcion);
    const repetidas = (await sesion.repo.parecidas({ tipo, centavos: operacion.centavos, fecha })).filter((otra) =>
      operacion.referencia && otra.referencia ? otra.referencia === operacion.referencia : palabras(otra.descripcion) === detalle,
    );

    const transaccion = await sesion.repo.crearTransaccion({
      tipo,
      centavos: operacion.centavos,
      fecha,
      descripcion: operacion.descripcion,
      categoriaId: categoria?.id ?? null,
      frascoId: ES_ENTRADA[tipo] || operacion.interna ? null : (buscarFrasco(operacion.descripcion, sesion.frascos)?.id ?? null),
      interna: operacion.interna,
      origenMensajeId: propio.id,
      metodo: "imagen",
      contraparte: operacion.contraparte,
      referencia: operacion.referencia,
    });
    transacciones.push(transaccion);
    avisos[transaccion.id] = [
      ...(operacion.tipo ? [] : (["sentido"] as const)),
      ...(operacion.importeDudoso ? (["importe_dudoso"] as const) : []),
      ...(operacion.fecha ? [] : (["sin_fecha"] as const)),
      ...(operacion.interna ? (["propia"] as const) : []),
      ...(repetidas.length ? (["duplicado"] as const) : []),
    ];
  }

  const texto = transacciones.length === 1 ? voz.capturaUna : voz.capturaVarias(transacciones.length);
  const mensaje = await decir(sesion, texto, { clase: "lote", transaccionIds: transacciones.map((t) => t.id), avisos });
  return { propio, mensajes: [mensaje], transacciones };
}

/** Confirma varios movimientos de una captura de una sola vez. */
export async function confirmarVarios(sesion: Sesion, ids: string[]): Promise<Novedad> {
  const transacciones: Transaccion[] = [];
  for (const id of ids) transacciones.push(await sesion.repo.actualizarTransaccion(id, { estado: "confirmada" }));
  if (transacciones.some((t) => t.frascoId)) await refrescarFrascos(sesion);
  return { mensajes: [await decir(sesion, voz.anotadosVarios(transacciones.length))], transacciones };
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
