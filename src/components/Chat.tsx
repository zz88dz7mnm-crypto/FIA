"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorDeDatos, type Repositorio } from "@/lib/datos/repositorio";
import {
  abrir,
  anular,
  confirmar,
  confirmarVarios,
  descartar,
  editar,
  recibir,
  recibirCaptura,
  type Novedad,
  type Sesion,
} from "@/lib/fia/conversacion";
import { EJEMPLOS, voz } from "@/lib/fia/voz";
import { nombreDeMes, rangoDe } from "@/lib/motor/fechas";
import { formatearImporte } from "@/lib/motor/importes";
import { capitalizar } from "@/lib/motor/texto";
import { leerImagen } from "@/lib/ocr";
import { ES_ENTRADA, type Mensaje, type Transaccion } from "@/lib/tipos";
import { Fia } from "./Fia";
import { TicketFrascos, TicketLista, TicketResumen } from "./Resumenes";
import { Ticket, type AccionesDeTicket } from "./Ticket";

const ATAJOS = ["Resumen del mes", "Últimos movimientos", "Mis frascos"];

const ETIQUETA_DE_TIPO = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  transferencia_enviada: "La envié",
  transferencia_recibida: "La recibí",
} as const;

export function Chat({ repo, salir }: { repo: Repositorio; salir?: () => void }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [transacciones, setTransacciones] = useState<Record<string, Transaccion>>({});
  const [hoy, setHoy] = useState("");
  const [salioEsteMes, setSalioEsteMes] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [noCargo, setNoCargo] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  /** Mensajes que ya estaban al abrir: esos no se animan. */
  const [iniciales, setIniciales] = useState<ReadonlySet<string>>(new Set());
  /** Vista previa de las capturas enviadas en esta sesión. La imagen no se guarda en la base. */
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});

  const raiz = useRef<HTMLDivElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  const selector = useRef<HTMLInputElement>(null);
  const locales = useRef(0);
  const enlaces = useRef<string[]>([]);

  const actualizarEncabezado = useCallback(async (s: Sesion) => {
    const fecha = s.hoy();
    setHoy(fecha);
    const mes = rangoDe("mes", fecha);
    const delMes = await s.repo.confirmadasEntre(mes.desde, mes.hasta);
    setSalioEsteMes(delMes.filter((t) => !ES_ENTRADA[t.tipo]).reduce((suma, t) => suma + t.centavos, 0));
  }, []);

  useEffect(() => {
    let vigente = true;
    const enlacesCreados = enlaces.current;
    abrir(repo)
      .then(async (abierta) => {
        if (!vigente) return;
        setSesion(abierta.sesion);
        setMensajes(abierta.mensajes);
        setIniciales(new Set(abierta.mensajes.map((m) => m.id)));
        setTransacciones(Object.fromEntries(abierta.transacciones.map((t) => [t.id, t])));
        await actualizarEncabezado(abierta.sesion);
      })
      .catch((error) => {
        if (!vigente) return;
        const desactualizada = error instanceof ErrorDeDatos && error.baseDesactualizada;
        setNoCargo(desactualizada ? voz.baseDesactualizada : "No pude abrir tu libreta. Revisá la conexión y volvé a entrar.");
      });
    return () => {
      vigente = false;
      enlacesCreados.forEach((enlace) => URL.revokeObjectURL(enlace));
    };
  }, [repo, actualizarEncabezado]);

  // En iPhone el teclado tapa la pantalla sin achicarla: se ajusta el alto a lo que queda visible.
  useEffect(() => {
    const visible = window.visualViewport;
    if (!visible) return;
    const ajustar = () => {
      if (raiz.current) raiz.current.style.height = `${visible.height}px`;
      window.scrollTo(0, 0);
    };
    ajustar();
    visible.addEventListener("resize", ajustar);
    return () => visible.removeEventListener("resize", ajustar);
  }, []);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end", behavior: mensajes.length > iniciales.size ? "smooth" : "auto" });
  }, [mensajes, ocupado, iniciales]);

  const mensajeLocal = (autor: Mensaje["autor"], contenido: string, datos: Mensaje["datos"] = { clase: "texto" }): Mensaje => ({
    id: `local-${++locales.current}`,
    autor,
    texto: contenido,
    datos,
    creadoEn: "",
  });

  /** Corre una acción contra la base y vuelca al chat lo que haya cambiado. */
  async function correr(s: Sesion, accion: (s: Sesion) => Promise<Novedad & { propio?: Mensaje }>, opciones: { reemplaza?: string } = {}) {
    setOcupado(true);
    try {
      const novedad = await accion(s);
      const { propio } = novedad;
      const { reemplaza } = opciones;
      setMensajes((previos) => [...previos.map((m) => (m.id === reemplaza && propio ? propio : m)), ...novedad.mensajes]);
      if (propio && reemplaza) setMiniaturas((previas) => (previas[reemplaza] ? { ...previas, [propio.id]: previas[reemplaza] } : previas));
      setTransacciones((previas) => ({ ...previas, ...Object.fromEntries(novedad.transacciones.map((t) => [t.id, t])) }));
      if (novedad.transacciones.length) void actualizarEncabezado(s).catch(() => {});
      return true;
    } catch (error) {
      const desactualizada = error instanceof ErrorDeDatos && error.baseDesactualizada;
      setMensajes((previos) => [...previos, mensajeLocal("fia", desactualizada ? voz.baseDesactualizada : voz.falla)]);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function ejecutar(accion: (s: Sesion) => Promise<Novedad>) {
    if (!sesion || ocupado) return;
    void correr(sesion, accion);
  }

  async function enviar(contenido: string) {
    const limpio = contenido.trim();
    if (!limpio || !sesion || ocupado) return;
    const ultimoMensaje = mensajes.at(-1);
    const anterior = ultimoMensaje?.autor === "fia" && !ultimoMensaje.id.startsWith("local-") ? ultimoMensaje : null;
    const propio = mensajeLocal("usuario", limpio);
    setMensajes((previos) => [...previos, propio]);
    setTexto("");
    const salioBien = await correr(sesion, (s) => recibir(s, limpio, anterior), { reemplaza: propio.id });
    if (!salioBien) setTexto(limpio);
  }

  /** Lee cada captura en el celular y manda a Fia solo el texto encontrado. */
  async function adjuntar(archivos: File[]) {
    if (!sesion || ocupado) return;
    for (const archivo of archivos) {
      const propio = mensajeLocal("usuario", "", { clase: "captura" });
      const enlace = URL.createObjectURL(archivo);
      enlaces.current.push(enlace);
      setMiniaturas((previas) => ({ ...previas, [propio.id]: enlace }));
      setMensajes((previos) => [...previos, propio]);
      setOcupado(true);
      setLeyendo(true);

      let leido: string;
      try {
        leido = await leerImagen(archivo);
      } catch {
        setMensajes((previos) => [...previos, mensajeLocal("fia", voz.capturaIlegible)]);
        setOcupado(false);
        continue;
      } finally {
        setLeyendo(false);
      }
      await correr(sesion, (s) => recibirCaptura(s, leido), { reemplaza: propio.id });
    }
  }

  const acciones: AccionesDeTicket = {
    confirmar: (id) => ejecutar((s) => confirmar(s, id)),
    descartar: (id) => ejecutar((s) => descartar(s, id)),
    anular: (id) => ejecutar((s) => anular(s, id)),
    editar: (id, cambios, yaAnotado) => ejecutar((s) => editar(s, id, cambios, yaAnotado)),
  };

  const estado = leyendo
    ? voz.capturaLeyendo
    : ocupado
      ? "anotando…"
      : salioEsteMes === null || !hoy
        ? "tu libreta de gastos"
        : `${capitalizar(nombreDeMes(hoy))}: salió ${formatearImporte(salioEsteMes)}`;

  const ultimo = mensajes.at(-1);
  const categorias = sesion?.categorias ?? [];
  const frascos = sesion?.frascos ?? [];

  return (
    <div ref={raiz} className="fixed inset-x-0 top-0 mx-auto flex h-dvh w-full max-w-md flex-col md:border-x md:border-linea">
      <header className="relative flex items-center gap-3 border-b border-linea px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2.5">
        <Fia className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] leading-none font-extrabold tracking-tight">Fia</h1>
          <p className="mt-1 truncate text-[13px] text-tinta-suave" aria-live="polite">
            {estado}
          </p>
        </div>
        {salir ? (
          <button
            type="button"
            aria-label="Más opciones"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="grid size-11 place-items-center rounded-full text-tinta-suave active:bg-tinta/5"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        ) : (
          <span className="rounded-full border border-linea px-2.5 py-1 font-mono text-[11px] tracking-wider text-tinta-suave uppercase">
            Demo
          </span>
        )}
        {menuAbierto && salir && (
          <>
            <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuAbierto(false)} />
            <div className="sombra-ticket absolute top-full right-3 z-20 -mt-1 rounded-xl bg-ticket p-1">
              <button type="button" onClick={salir} className="h-11 rounded-lg px-4 text-[15px] font-medium text-tinta active:bg-tinta/5">
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-live="polite">
        {noCargo && (
          <p role="alert" className="mx-auto mt-10 max-w-xs text-center text-[15px] leading-snug text-tinta-suave">
            {noCargo}
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {mensajes.map((mensaje, indice) => {
            const animar = !iniciales.has(mensaje.id);
            const esUltimo = mensaje === ultimo;
            const datos = mensaje.datos;

            if (mensaje.autor === "usuario") {
              return (
                <li key={mensaje.id} className={`mt-1 flex justify-end ${animar ? "animate-entrar" : ""}`}>
                  {datos.clase === "captura" ? (
                    <Captura enlace={miniaturas[mensaje.id]} />
                  ) : (
                    <p className="max-w-[80%] rounded-[18px] rounded-br-md bg-birome px-3.5 py-2.5 text-[16px] leading-snug break-words text-white">
                      {mensaje.texto}
                    </p>
                  )}
                </li>
              );
            }

            const abreGrupo = mensajes[indice - 1]?.autor !== "fia";
            const pendientes =
              datos.clase === "lote"
                ? datos.transaccionIds.filter((id) => transacciones[id]?.estado === "en_revision" && !datos.avisos[id]?.includes("sentido"))
                : [];
            return (
              <li key={mensaje.id} className={`flex items-start gap-2 ${abreGrupo ? "mt-1" : ""}`}>
                <div className="w-8 shrink-0 pt-0.5">{abreGrupo && <Fia className="size-8" />}</div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                  {mensaje.texto && (
                    <p
                      className={`max-w-[88%] rounded-[18px] rounded-bl-md bg-ticket px-3.5 py-2.5 text-[16px] leading-snug shadow-[0_1px_0_var(--color-linea)] ${animar ? "animate-entrar" : ""}`}
                    >
                      {mensaje.texto}
                    </p>
                  )}

                  {datos.clase === "propuesta" && transacciones[datos.transaccionId] && (
                    <Ticket
                      transaccion={transacciones[datos.transaccionId]}
                      categorias={categorias}
                      frascos={frascos}
                      hoy={hoy}
                      avisos={datos.aviso ? [datos.aviso] : []}
                      ocupado={ocupado}
                      animar={animar}
                      acciones={acciones}
                    />
                  )}
                  {datos.clase === "lote" &&
                    datos.transaccionIds.map(
                      (id) =>
                        transacciones[id] && (
                          <Ticket
                            key={id}
                            transaccion={transacciones[id]}
                            categorias={categorias}
                            frascos={frascos}
                            hoy={hoy}
                            avisos={datos.avisos[id]}
                            ocupado={ocupado}
                            animar={animar}
                            acciones={acciones}
                          />
                        ),
                    )}
                  {pendientes.length > 1 && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => ejecutar((s) => confirmarVarios(s, pendientes))}
                      className="h-10 rounded-full border border-birome/35 bg-ticket px-4 text-[14px] font-semibold text-birome active:bg-birome/10 disabled:opacity-50"
                    >
                      Anotar los {pendientes.length}
                    </button>
                  )}
                  {datos.clase === "resumen" && <TicketResumen resumen={datos.resumen} animar={animar} />}
                  {datos.clase === "frascos" && <TicketFrascos frascos={datos.frascos} animar={animar} />}
                  {datos.clase === "lista" && (
                    <TicketLista
                      transacciones={datos.transaccionIds.map((id) => transacciones[id]).filter(Boolean)}
                      categorias={categorias}
                      hoy={hoy}
                      animar={animar}
                    />
                  )}

                  {esUltimo && datos.clase === "pregunta" && (
                    <Opciones
                      deshabilitadas={ocupado}
                      alElegir={enviar}
                      opciones={
                        datos.falta === "tipo"
                          ? datos.opcionesTipo.map((tipo) => ETIQUETA_DE_TIPO[tipo])
                          : datos.opcionesImporte.map((opcion) => formatearImporte(opcion.centavos))
                      }
                    />
                  )}
                  {esUltimo && datos.clase === "ejemplos" && <Opciones deshabilitadas={ocupado} alElegir={enviar} opciones={EJEMPLOS} />}
                </div>
              </li>
            );
          })}

          {ocupado && (
            <li className="flex items-start gap-2" aria-label={leyendo ? "Fia está leyendo la captura" : "Fia está anotando"}>
              <div className="w-8 shrink-0" />
              <p className="flex h-10 items-center gap-1 rounded-[18px] rounded-bl-md bg-ticket px-4 shadow-[0_1px_0_var(--color-linea)]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="animate-punto size-1.5 rounded-full bg-birome" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </p>
            </li>
          )}
        </ol>
        <div ref={fin} className="h-px scroll-mb-4" />
      </main>

      <footer className="border-t border-linea bg-papel px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
          {ATAJOS.map((atajo) => (
            <button
              key={atajo}
              type="button"
              disabled={ocupado || !sesion}
              onClick={() => enviar(atajo)}
              className="h-9 shrink-0 rounded-full border border-linea px-3.5 text-[13px] font-medium text-tinta-suave active:bg-tinta/5 disabled:opacity-50"
            >
              {atajo}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            void enviar(texto);
          }}
        >
          <input
            ref={selector}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(evento) => {
              const elegidos = Array.from(evento.target.files ?? []);
              evento.target.value = "";
              void adjuntar(elegidos);
            }}
          />
          <button
            type="button"
            aria-label="Mandar una captura"
            disabled={ocupado || !sesion}
            onClick={() => selector.current?.click()}
            className="grid size-12 shrink-0 place-items-center rounded-full border border-linea bg-ticket text-birome transition-colors active:bg-birome/10 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="3" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m5 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L15 16.5l1.7-1.7a1.5 1.5 0 0 1 2.1 0L20.5 16.5" />
            </svg>
          </button>
          <label htmlFor="mensaje" className="sr-only">
            Mensaje para Fia
          </label>
          <input
            id="mensaje"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Contame un gasto…"
            autoComplete="off"
            enterKeyHint="send"
            className="h-12 min-w-0 flex-1 rounded-full border border-linea bg-ticket px-4 text-[16px] outline-none placeholder:text-tinta-suave/70 focus:border-birome focus:ring-2 focus:ring-birome/20"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!texto.trim() || ocupado || !sesion}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-birome text-white transition-colors active:bg-birome-oscuro disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}

/** La captura que mandó el usuario. Al recargar ya no hay imagen: queda solo la marca. */
function Captura({ enlace }: { enlace: string | undefined }) {
  if (enlace) {
    return (
      // La imagen vive solo en el celular (enlace temporal): no pasa por el optimizador de imágenes.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={enlace} alt="Captura enviada" className="max-h-56 max-w-[60%] rounded-2xl border border-linea object-cover" />
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-[18px] rounded-br-md bg-birome px-3.5 py-2.5 text-[16px] leading-snug text-white">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="14" rx="3" />
        <circle cx="9" cy="10" r="1.6" />
      </svg>
      Captura
    </p>
  );
}

function Opciones({ opciones, alElegir, deshabilitadas }: { opciones: string[]; alElegir: (texto: string) => void; deshabilitadas: boolean }) {
  if (!opciones.length) return null;
  return (
    <div className="animate-entrar flex flex-wrap gap-2">
      {opciones.map((opcion) => (
        <button
          key={opcion}
          type="button"
          disabled={deshabilitadas}
          onClick={() => alElegir(opcion)}
          className="min-h-10 rounded-full border border-birome/35 bg-ticket px-4 py-2 text-left text-[14px] font-medium text-birome active:bg-birome/10 disabled:opacity-50"
        >
          {opcion}
        </button>
      ))}
    </div>
  );
}
