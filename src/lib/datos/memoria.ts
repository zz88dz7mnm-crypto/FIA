import { CATEGORIAS_DE_MUESTRA } from "../motor/muestras";
import { ES_ENTRADA, type Mensaje, type Perfil, type Transaccion } from "../tipos";
import type { Repositorio } from "./repositorio";

/** Repositorio que vive en memoria: para las pruebas y para el modo demo. No guarda nada. */
export function repositorioEnMemoria(): Repositorio {
  const perfil: Perfil = { nombre: null, zonaHoraria: "America/Argentina/Buenos_Aires" };
  const mensajes: Mensaje[] = [];
  const transacciones: Transaccion[] = [];
  const frascos: { id: string; nombre: string }[] = [];
  const aportes: { frascoId: string; centavos: number }[] = [];
  let reloj = 0;
  const ahora = () => new Date(Date.UTC(2026, 0, 1, 0, 0, reloj++)).toISOString();
  const nuevoId = (prefijo: string) => `${prefijo}-${reloj}`;

  return {
    async perfil() {
      return { ...perfil };
    },
    async guardarNombre(nombre) {
      perfil.nombre = nombre;
    },
    async categorias() {
      return CATEGORIAS_DE_MUESTRA;
    },
    async reglas() {
      return [];
    },
    async mensajes(limite) {
      return mensajes.slice(-limite);
    },
    async agregarMensaje({ autor, texto, datos = { clase: "texto" } }) {
      const mensaje: Mensaje = { id: nuevoId("m"), autor, texto, datos, creadoEn: ahora() };
      mensajes.push(mensaje);
      return mensaje;
    },
    async transaccionesPorId(ids) {
      return transacciones.filter((t) => ids.includes(t.id)).map((t) => ({ ...t }));
    },
    async crearTransaccion(nueva) {
      const transaccion: Transaccion = {
        id: nuevoId("t"),
        tipo: nueva.tipo,
        centavos: nueva.centavos,
        fecha: nueva.fecha,
        descripcion: nueva.descripcion,
        categoriaId: nueva.categoriaId,
        frascoId: nueva.frascoId ?? null,
        referencia: nueva.referencia ?? null,
        estado: "en_revision",
        creadoEn: ahora(),
      };
      transacciones.push(transaccion);
      return { ...transaccion };
    },
    async actualizarTransaccion(id, cambios) {
      const transaccion = transacciones.find((t) => t.id === id);
      if (!transaccion) throw new Error("No existe ese movimiento");
      Object.assign(transaccion, cambios);
      return { ...transaccion };
    },
    async parecidas({ tipo, centavos, fecha }) {
      return transacciones
        .filter((t) => t.tipo === tipo && t.centavos === centavos && t.fecha === fecha)
        .filter((t) => t.estado === "confirmada" || t.estado === "en_revision")
        .map((t) => ({ ...t }));
    },
    async confirmadasEntre(desde, hasta) {
      return transacciones
        .filter((t) => t.estado === "confirmada" && t.fecha >= desde && t.fecha <= hasta)
        .map((t) => ({ ...t }));
    },
    async ultimas(limite) {
      return transacciones
        .filter((t) => t.estado === "confirmada")
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
        .slice(0, limite)
        .map((t) => ({ ...t }));
    },
    async frascos() {
      return frascos.map((f) => ({
        ...f,
        asignado: aportes.filter((a) => a.frascoId === f.id).reduce((suma, a) => suma + a.centavos, 0),
        gastado: transacciones
          .filter((t) => t.frascoId === f.id && t.estado === "confirmada" && !ES_ENTRADA[t.tipo])
          .reduce((suma, t) => suma + t.centavos, 0),
      }));
    },
    async crearFrasco(nombre) {
      const frasco = { id: nuevoId("f") + frascos.length, nombre };
      frascos.push(frasco);
      return { ...frasco };
    },
    async aportarAFrasco(id, centavos) {
      aportes.push({ frascoId: id, centavos });
    },
    async borrarFrasco(id) {
      frascos.splice(frascos.findIndex((f) => f.id === id), 1);
      transacciones.forEach((t) => {
        if (t.frascoId === id) t.frascoId = null;
      });
    },
  };
}
