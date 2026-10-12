import type { SupabaseClient } from "@supabase/supabase-js";
import { centavosADecimal, decimalACentavos } from "../motor/importes";
import { ES_ENTRADA, type DatosMensaje, type Mensaje, type Transaccion } from "../tipos";
import { ErrorDeDatos, type CambiosTransaccion, type Repositorio } from "./repositorio";

type FilaTransaccion = {
  id: string;
  tipo: Transaccion["tipo"];
  importe: number | string;
  fecha: string;
  descripcion: string;
  categoria_id: string | null;
  frasco_id: string | null;
  contraparte: string | null;
  es_interna: boolean;
  referencia: string | null;
  metodo: Transaccion["metodo"];
  estado: Transaccion["estado"];
  creado_en: string;
};

type FilaMensaje = { id: string; autor: Mensaje["autor"]; texto: string; datos: DatosMensaje | Record<string, never>; creado_en: string };

const COLUMNAS_TRANSACCION = "id, tipo, importe, fecha, descripcion, categoria_id, frasco_id, contraparte, es_interna, referencia, metodo, estado, creado_en";
const FILAS_POR_PAGINA = 1000;
const COLUMNAS_MENSAJE = "id, autor, texto, datos, creado_en";

const aTransaccion = (f: FilaTransaccion): Transaccion => ({
  id: f.id,
  tipo: f.tipo,
  centavos: decimalACentavos(f.importe),
  fecha: f.fecha,
  descripcion: f.descripcion,
  categoriaId: f.categoria_id,
  frascoId: f.frasco_id,
  contraparte: f.contraparte,
  interna: f.es_interna,
  referencia: f.referencia,
  metodo: f.metodo,
  estado: f.estado,
  creadoEn: f.creado_en,
});

const aMensaje = (f: FilaMensaje): Mensaje => ({
  id: f.id,
  autor: f.autor,
  texto: f.texto,
  datos: "clase" in f.datos ? (f.datos as DatosMensaje) : { clase: "texto" },
  creadoEn: f.creado_en,
});

type FilaPerfil = { nombre: string | null; zona_horaria: string };
type FilaCategoria = { id: string; nombre: string; clase: "gasto" | "ingreso"; palabras_clave: string[] | null };
type FilaRegla = { patron: string; categoria_id: string };

/** Lanza si Supabase devolvió error; si no, entrega los datos con el tipo de fila esperado. */
function exigir<T>({ data, error }: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (error) throw new ErrorDeDatos(error.message, error.code);
  return data as T;
}

/** Repositorio real. La base filtra por usuario (RLS), así que acá no hace falta. */
export function repositorioSupabase(db: SupabaseClient, usuarioId: string): Repositorio {
  return {
    async perfil() {
      const columnas = "nombre, zona_horaria";
      const fila =
        exigir<FilaPerfil | null>(await db.from("perfiles").select(columnas).eq("id", usuarioId).maybeSingle()) ??
        exigir<FilaPerfil>(await db.from("perfiles").insert({ id: usuarioId }).select(columnas).single());
      return { nombre: fila.nombre, zonaHoraria: fila.zona_horaria };
    },
    async guardarNombre(nombre) {
      exigir<unknown>(await db.from("perfiles").update({ nombre }).eq("id", usuarioId).select("id"));
    },
    async categorias() {
      const filas = exigir<FilaCategoria[]>(await db.from("categorias").select("id, nombre, clase, palabras_clave").order("nombre"));
      return filas.map((f) => ({ id: f.id, nombre: f.nombre, clase: f.clase, palabrasClave: f.palabras_clave ?? [] }));
    },
    async crearCategoria(nombre, clase) {
      const fila = exigir<FilaCategoria>(
        await db.from("categorias").insert({ nombre, clase }).select("id, nombre, clase, palabras_clave").single(),
      );
      return { id: fila.id, nombre: fila.nombre, clase: fila.clase, palabrasClave: fila.palabras_clave ?? [] };
    },
    async guardarRegla(patron, categoriaId) {
      exigir<unknown>(
        await db.from("reglas_categoria").upsert({ patron, categoria_id: categoriaId }, { onConflict: "usuario_id,patron" }).select("id"),
      );
    },
    async borrarRegla(patron) {
      exigir<unknown>(await db.from("reglas_categoria").delete().eq("patron", patron).select("id"));
    },
    async reglas() {
      const filas = exigir<FilaRegla[]>(await db.from("reglas_categoria").select("patron, categoria_id"));
      return filas.map((f) => ({ patron: f.patron, categoriaId: f.categoria_id }));
    },
    async mensajes(limite) {
      const filas = exigir<FilaMensaje[]>(
        await db.from("mensajes").select(COLUMNAS_MENSAJE).order("creado_en", { ascending: false }).limit(limite),
      );
      return filas.map(aMensaje).reverse();
    },
    async agregarMensaje({ autor, texto, datos = { clase: "texto" }, textoExtraido }) {
      const fila = exigir<FilaMensaje>(
        await db.from("mensajes").insert({ autor, texto, datos, texto_extraido: textoExtraido ?? null }).select(COLUMNAS_MENSAJE).single(),
      );
      return aMensaje(fila);
    },
    async transaccionesPorId(ids) {
      if (!ids.length) return [];
      const filas = exigir<FilaTransaccion[]>(await db.from("transacciones").select(COLUMNAS_TRANSACCION).in("id", ids));
      return filas.map(aTransaccion);
    },
    async crearTransaccion(nueva) {
      const fila = exigir<FilaTransaccion>(
        await db
          .from("transacciones")
          .insert({
            tipo: nueva.tipo,
            importe: centavosADecimal(nueva.centavos),
            fecha: nueva.fecha,
            descripcion: nueva.descripcion,
            categoria_id: nueva.categoriaId,
            origen_mensaje_id: nueva.origenMensajeId,
            frasco_id: nueva.frascoId ?? null,
            contraparte: nueva.contraparte ?? null,
            es_interna: nueva.interna ?? false,
            referencia: nueva.referencia ?? null,
            estado: "en_revision",
            metodo: nueva.metodo ?? "texto",
          })
          .select(COLUMNAS_TRANSACCION)
          .single(),
      );
      return aTransaccion(fila);
    },
    async actualizarTransaccion(id, cambios) {
      const fila = exigir<FilaTransaccion>(
        await db.from("transacciones").update(aColumnas(cambios)).eq("id", id).select(COLUMNAS_TRANSACCION).single(),
      );
      return aTransaccion(fila);
    },
    async parecidas({ tipo, centavos, fecha }) {
      const filas = exigir<FilaTransaccion[]>(
        await db
          .from("transacciones")
          .select(COLUMNAS_TRANSACCION)
          .eq("tipo", tipo)
          .eq("importe", centavosADecimal(centavos))
          .eq("fecha", fecha)
          .in("estado", ["confirmada", "en_revision"]),
      );
      return filas.map(aTransaccion);
    },
    async confirmadasEntre(desde, hasta) {
      const filas = exigir<FilaTransaccion[]>(
        await db
          .from("transacciones")
          .select(COLUMNAS_TRANSACCION)
          .eq("estado", "confirmada")
          .eq("es_interna", false)
          .gte("fecha", desde)
          .lte("fecha", hasta),
      );
      return filas.map(aTransaccion);
    },
    async ultimas(limite) {
      const filas = exigir<FilaTransaccion[]>(
        await db
          .from("transacciones")
          .select(COLUMNAS_TRANSACCION)
          .eq("estado", "confirmada")
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .limit(limite),
      );
      return filas.map(aTransaccion);
    },
    async movimientosEntre(desde, hasta) {
      // La API entrega de a mil filas: se piden páginas hasta agotar el rango.
      const todas: FilaTransaccion[] = [];
      for (let pagina = 0; ; pagina++) {
        const filas = exigir<FilaTransaccion[]>(
          await db
            .from("transacciones")
            .select(COLUMNAS_TRANSACCION)
            .gte("fecha", desde)
            .lte("fecha", hasta)
            .order("fecha", { ascending: false })
            .order("creado_en", { ascending: false })
            .range(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA - 1),
        );
        todas.push(...filas);
        if (filas.length < FILAS_POR_PAGINA) break;
      }
      return todas.map(aTransaccion);
    },
    async borrarMes(desde, hasta) {
      const resultado = exigir<{ movimientos: number }>(await db.rpc("fia_borrar_mes", { desde, hasta }));
      return { movimientos: resultado.movimientos };
    },
    async frascos() {
      const [frascos, aportes, gastos] = await Promise.all([
        db.from("frascos").select("id, nombre").order("creado_en"),
        db.from("aportes_frasco").select("frasco_id, importe"),
        db.from("transacciones").select("frasco_id, importe, tipo").eq("estado", "confirmada").not("frasco_id", "is", null),
      ]);
      const sumar = (filas: { frasco_id: string; importe: number | string }[], id: string) =>
        filas.filter((f) => f.frasco_id === id).reduce((suma, f) => suma + decimalACentavos(f.importe), 0);
      const salidas = exigir<{ frasco_id: string; importe: number | string; tipo: Transaccion["tipo"] }[]>(gastos).filter((g) => !ES_ENTRADA[g.tipo]);
      const puestos = exigir<{ frasco_id: string; importe: number | string }[]>(aportes);
      return exigir<{ id: string; nombre: string }[]>(frascos).map((f) => ({
        id: f.id,
        nombre: f.nombre,
        asignado: sumar(puestos, f.id),
        gastado: sumar(salidas, f.id),
      }));
    },
    async crearFrasco(nombre) {
      return exigir<{ id: string; nombre: string }>(await db.from("frascos").insert({ nombre }).select("id, nombre").single());
    },
    async aportarAFrasco(id, centavos) {
      exigir<unknown>(await db.from("aportes_frasco").insert({ frasco_id: id, importe: centavosADecimal(centavos) }).select("id"));
    },
    async borrarFrasco(id) {
      exigir<unknown>(await db.from("frascos").delete().eq("id", id).select("id"));
    },
  };
}

function aColumnas(cambios: CambiosTransaccion): Record<string, unknown> {
  const columnas: Record<string, unknown> = {};
  if (cambios.tipo !== undefined) columnas.tipo = cambios.tipo;
  if (cambios.centavos !== undefined) columnas.importe = centavosADecimal(cambios.centavos);
  if (cambios.fecha !== undefined) columnas.fecha = cambios.fecha;
  if (cambios.descripcion !== undefined) columnas.descripcion = cambios.descripcion;
  if (cambios.categoriaId !== undefined) columnas.categoria_id = cambios.categoriaId;
  if (cambios.frascoId !== undefined) columnas.frasco_id = cambios.frascoId;
  if (cambios.interna !== undefined) columnas.es_interna = cambios.interna;
  if (cambios.estado !== undefined) columnas.estado = cambios.estado;
  return columnas;
}
