"use client";

import Link from "next/link";
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
import { IconoEnviar, IconoImagen, IconoMas, IconoPanel } from "./iconos";
import { TicketFrascos, TicketLista, TicketResumen } from "./Resumenes";
import { Ticket, type AccionesDeTicket } from "./Ticket";

const ATAJOS = ["Resumen del mes", "Últimos movimientos", "Mis frascos"];

const ETIQUETA_DE_TIPO = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  transferencia_enviada: "La envié",
  transferencia_recibida: "La recibí",
} as const;

type Props = { repo: Repositorio; rutaPanel: string; salir?: () => void };

export function Chat({ repo, rutaPanel, salir }: Props) {
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
  /** Vista previa de las capturas enviadas en esta sesión. La imagen nunca se sube ni se guarda. */
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

  /** Vuelca en pantalla lo leído de la base. Se usa al abrir y después de borrar un mes. */
  const mostrar = useCallback(
    async (abierta: Awaited<ReturnType<typeof abrir>>) => {
      setSesion(abierta.sesion);
      setMensajes(abierta.mensajes);
      setIniciales(new Set(abierta.mensajes.map((m) => m.id)));
      setTransacciones(Object.fromEntries(abierta.transacciones.map((t) => [t.id, t])));
      await actualizarEncabezado(abierta.sesion);
    },
    [actualizarEncabezado],
  );

  useEffect(() => {
    let vigente = true;
    const enlacesCreados = enlaces.current;
    abrir(repo)
      .then((abierta) => (vigente ? mostrar(abierta) : undefined))
      .catch((error) => {
        if (!vigente) return;
        const desactualizada = error instanceof ErrorDeDatos && error.baseDesactualizada;
        setNoCargo(desactualizada ? voz.baseDesactualizada : "No pude abrir tu libreta. Revisá la conexión y volvé a entrar.");
      });
    return () => {
      vigente = false;
      enlacesCreados.forEach((enlace) => URL.revokeObjectURL(enlace));
    };
  }, [repo, mostrar]);

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
  async function correr(s: Sesion, accion: (s: Sesion) => Promise<Novedad & { propio?: Mensaje }>, reemplaza?: string) {
    setOcupado(true);
    try {
      const novedad = await accion(s);
      if (novedad.recargar) {
        await mostrar(await abrir(repo));
        return true;
      }
      const { propio } = novedad;
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
    const salioBien = await correr(sesion, (s) => recibir(s, limpio, anterior), propio.id);
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
      await correr(sesion, (s) => recibirCaptura(s, leido), propio.id);
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
    <div ref={raiz} className="fixed inset-x-0 top-0 h-dvh">
      {/* La barra de arriba y la de abajo flotan: la conversación pasa por detrás del vidrio. */}
      <header className="absolute inset-x-0 top-0 z-20 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="cristal relative mx-auto flex max-w-3xl items-center gap-3 rounded-[26px] py-2 pr-2 pl-3">
          <Fia className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">Fia</h1>
            <p className="truncate text-[13px] leading-tight text-tinta-suave" aria-live="polite">
              {estado}
            </p>
          </div>
          <Link
            href={rutaPanel}
            className="flex h-10 items-center gap-1.5 rounded-full bg-black/5 px-3.5 text-[15px] font-medium text-acento transition-colors active:bg-black/10"
          >
            <IconoPanel className="size-[18px]" />
            Panel
          </Link>
          {salir && (
            <button
              type="button"
              aria-label="Más opciones"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((abierto) => !abierto)}
              className="grid size-10 place-items-center rounded-full text-tinta-suave transition-colors active:bg-black/5"
            >
              <IconoMas className="size-5" />
            </button>
          )}
          {menuAbierto && salir && (
            <>
              <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuAbierto(false)} />
              <div className="cristal absolute top-full right-0 z-20 mt-2 rounded-2xl p-1.5">
                <button type="button" onClick={salir} className="h-11 rounded-xl px-4 text-[16px] whitespace-nowrap text-rojo active:bg-black/5">
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="h-full overflow-y-auto overscroll-contain px-4" aria-live="polite">
        <div className="mx-auto max-w-3xl pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.75rem)] pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+8.25rem)]">
          {noCargo && (
            <p role="alert" className="cristal mx-auto mt-8 max-w-sm rounded-[24px] p-5 text-center text-[15px] leading-snug text-tinta-suave">
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
                  <li key={mensaje.id} className={`mt-1.5 flex justify-end ${animar ? "animate-entrar" : ""}`}>
                    {datos.clase === "captura" ? (
                      <Captura enlace={miniaturas[mensaje.id]} />
                    ) : (
                      <p className="max-w-[78%] rounded-[22px] bg-acento px-4 py-2.5 text-[17px] leading-[1.3] break-words text-white shadow-[0_6px_16px_-8px_rgb(10_102_232/0.6)]">
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
                <li key={mensaje.id} className={`flex flex-col items-start gap-2 ${abreGrupo ? "mt-1.5" : ""}`}>
                  {mensaje.texto && (
                    <p className={`cristal-leve max-w-[82%] rounded-[22px] px-4 py-2.5 text-[17px] leading-[1.3] ${animar ? "animate-entrar" : ""}`}>
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
                      className="cristal-leve h-10 rounded-full px-4 text-[15px] font-semibold text-acento active:bg-white disabled:opacity-50"
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
                  {esUltimo && datos.clase === "confirmar_borrado" && (
                    <Opciones
                      deshabilitadas={ocupado}
                      alElegir={enviar}
                      peligrosa={0}
                      opciones={[`Sí, borrar ${nombreDeMes(datos.desde)}`, "No, dejar todo"]}
                    />
                  )}
                </li>
              );
            })}

            {ocupado && (
              <li aria-label={leyendo ? "Fia está leyendo la captura" : "Fia está anotando"}>
                <p className="cristal-leve inline-flex h-11 items-center gap-1 rounded-[22px] px-4">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="animate-punto size-1.5 rounded-full bg-tinta-tenue" style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </p>
              </li>
            )}
          </ol>
          <div ref={fin} className="h-px scroll-mb-40" />
        </div>
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto max-w-3xl">
          <div className="sin-barra -mx-3 mb-2 flex gap-2 overflow-x-auto px-3 py-1">
            {ATAJOS.map((atajo) => (
              <button
                key={atajo}
                type="button"
                disabled={ocupado || !sesion}
                onClick={() => enviar(atajo)}
                className="cristal h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium text-tinta active:bg-white disabled:opacity-50"
              >
                {atajo}
              </button>
            ))}
          </div>
          <form
            className="cristal flex items-center gap-1 rounded-full p-1.5"
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
              className="grid size-10 shrink-0 place-items-center rounded-full text-acento transition-colors active:bg-black/5 disabled:opacity-40"
            >
              <IconoImagen className="size-6" />
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
              className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[17px] outline-none placeholder:text-tinta-tenue"
            />
            <button
              type="submit"
              aria-label="Enviar"
              disabled={!texto.trim() || ocupado || !sesion}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-acento text-white transition-colors active:bg-acento-oscuro disabled:bg-black/10 disabled:text-white"
            >
              <IconoEnviar className="size-5" />
            </button>
          </form>
        </div>
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
      <img src={enlace} alt="Captura enviada" className="max-h-60 max-w-[60%] rounded-[22px] border border-white/70 object-cover shadow-[0_10px_24px_-12px_rgb(20_30_70/0.35)]" />
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-[22px] bg-acento px-4 py-2.5 text-[17px] leading-[1.3] text-white">
      <IconoImagen className="size-5" />
      Captura
    </p>
  );
}

function Opciones({
  opciones,
  alElegir,
  deshabilitadas,
  peligrosa,
}: {
  opciones: string[];
  alElegir: (texto: string) => void;
  deshabilitadas: boolean;
  /** Posición de la opción que borra o no tiene vuelta atrás, si hay una. */
  peligrosa?: number;
}) {
  if (!opciones.length) return null;
  return (
    <div className="animate-entrar flex flex-wrap gap-2">
      {opciones.map((opcion, indice) => (
        <button
          key={opcion}
          type="button"
          disabled={deshabilitadas}
          onClick={() => alElegir(opcion)}
          className={`cristal-leve min-h-10 rounded-full px-4 py-2 text-left text-[15px] font-medium active:bg-white disabled:opacity-50 ${
            indice === peligrosa ? "text-rojo" : "text-acento"
          }`}
        >
          {opcion}
        </button>
      ))}
    </div>
  );
}
