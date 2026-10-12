import type { Categoria, ReglaPersonal } from "../motor/categorias";
import { CATEGORIAS_DE_MUESTRA } from "../motor/muestras";
import { ES_ENTRADA, type Mensaje, type Perfil, type Transaccion } from "../tipos";
import type { Repositorio } from "./repositorio";

/** Repositorio que vive en memoria: para las pruebas y para el modo demo. No guarda nada. */
export function repositorioEnMemoria(): Repositorio {
  const perfil: Perfil = { nombre: null, zonaHoraria: "America/Argentina/Buenos_Aires" };
  const mensajes: Mensaje[] = [];
  const transacciones: Transaccion[] = [];
  const categoriasPropias: Categoria[] = [];
  const reglas: ReglaPersonal[] = [];
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
      return [...CATEGORIAS_DE_MUESTRA, ...categoriasPropias];
    },
    async crearCategoria(nombre, clase) {
      const categoria: Categoria = { id: nuevoId("c") + categoriasPropias.length, nombre, clase, palabrasClave: [] };
      categoriasPropias.push(categoria);
      return { ...categoria };
    },
    async reglas() {
      return reglas.map((r) => ({ ...r }));
    },
    async guardarRegla(patron, categoriaId) {
      const existente = reglas.find((r) => r.patron === patron);
      if (existente) existente.categoriaId = categoriaId;
      else reglas.push({ patron, categoriaId });
    },
    async borrarRegla(patron) {
      const indice = reglas.findIndex((r) => r.patron === patron);
      if (indice >= 0) reglas.splice(indice, 1);
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
        contraparte: nueva.contraparte ?? null,
        interna: nueva.interna ?? false,
        referencia: nueva.referencia ?? null,
        metodo: nueva.metodo ?? "texto",
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
        .filter((t) => t.estado === "confirmada" && !t.interna && t.fecha >= desde && t.fecha <= hasta)
        .map((t) => ({ ...t }));
    },
    async ultimas(limite) {
      return transacciones
        .filter((t) => t.estado === "confirmada")
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
        .slice(0, limite)
        .map((t) => ({ ...t }));
    },
    async movimientosEntre(desde, hasta) {
      return transacciones
        .filter((t) => t.fecha >= desde && t.fecha <= hasta)
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
        .map((t) => ({ ...t }));
    },
    async borrarMes(desde, hasta) {
      // En memoria no hay fechas reales de creación: se borra el chat entero y todos los frascos.
      const quedan = transacciones.filter((t) => t.fecha < desde || t.fecha > hasta);
      const movimientos = transacciones.length - quedan.length;
      transacciones.splice(0, transacciones.length, ...quedan.map((t) => ({ ...t, frascoId: null })));
      mensajes.length = 0;
      frascos.length = 0;
      aportes.length = 0;
      return { movimientos };
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
