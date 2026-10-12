"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorDeDatos, type Repositorio } from "@/lib/datos/repositorio";
import { hoyEn } from "@/lib/fia/conversacion";
import { tituloDePeriodo, voz } from "@/lib/fia/voz";
import type { Categoria } from "@/lib/motor/categorias";
import { describirFecha, nombreDeMes, rangoDe, rangoPrevio, type Periodo } from "@/lib/motor/fechas";
import { formatearCompacto, formatearImporte } from "@/lib/motor/importes";
import {
  fechaCorta,
  gastoPorCategoria,
  porciones,
  serie,
  topeRedondo,
  totales,
  transferenciasPorPersona,
  variacion,
  type GrupoDeGasto,
  type Punto,
} from "@/lib/panel";
import { NOMBRE_DE_TIPO, type EstadoFrasco, type Transaccion } from "@/lib/tipos";
import { Fia } from "./Fia";
import { IconoChat, IconoFlecha, IconoMas } from "./iconos";
import { Frasco } from "./Resumenes";
import { Estado, Importe } from "./Ticket";

const PERIODOS: [Periodo, string][] = [
  ["semana", "Semana"],
  ["mes", "Mes"],
  ["mes_pasado", "Mes pasado"],
  ["anio", "Año"],
];

const FILTROS = [
  ["todos", "Todos"],
  ["gastos", "Gastos"],
  ["ingresos", "Ingresos"],
  ["transferencias", "Transferencias"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

const FILAS_VISIBLES = 150;

type Base = { hoy: string; categorias: Categoria[]; frascos: EstadoFrasco[] };
type Datos = { periodo: Periodo; desde: string; hasta: string; movimientos: Transaccion[]; previos: Transaccion[] };

/** Cómo se nombra el período anterior en una comparación. */
function periodoAnterior(periodo: Periodo, hoy: string): string {
  const { desde } = rangoPrevio(periodo, hoy);
  if (periodo === "semana") return "la semana anterior";
  if (periodo === "anio") return desde.slice(0, 4);
  return nombreDeMes(desde);
}

const cuenta = (t: Transaccion) => t.estado === "confirmada" && !t.interna;

export function Panel({ repo, rutaChat, salir }: { repo: Repositorio; rutaChat: string; salir?: () => void }) {
  const [base, setBase] = useState<Base | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    const avisar = (fallo: unknown) => {
      if (!vigente) return;
      const desactualizada = fallo instanceof ErrorDeDatos && fallo.baseDesactualizada;
      setError(desactualizada ? voz.baseDesactualizada : "No pude traer tus movimientos. Revisá la conexión y recargá la página.");
    };
    Promise.all([repo.perfil(), repo.categorias(), repo.frascos()])
      .then(([perfil, categorias, frascos]) => vigente && setBase({ hoy: hoyEn(perfil.zonaHoraria), categorias, frascos }))
      .catch(avisar);
    return () => {
      vigente = false;
    };
  }, [repo]);

  useEffect(() => {
    if (!base) return;
    let vigente = true;
    const actual = rangoDe(periodo, base.hoy);
    const previo = rangoPrevio(periodo, base.hoy);
    Promise.all([repo.movimientosEntre(actual.desde, actual.hasta), repo.movimientosEntre(previo.desde, previo.hasta)])
      .then(([movimientos, previos]) => vigente && setDatos({ periodo, ...actual, movimientos, previos }))
      .catch(() => vigente && setError("No pude traer tus movimientos. Revisá la conexión y recargá la página."));
    return () => {
      vigente = false;
    };
  }, [repo, base, periodo]);

  // Mientras llega el período nuevo se sigue mostrando el anterior, atenuado: sin saltos ni pantallas vacías.
  const cargando = !datos || datos.periodo !== periodo;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="cristal relative mx-auto flex max-w-6xl items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-2">
          <Fia className="size-9 shrink-0" />
          <p className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.01em]">Panel</p>
          <Link
            href={rutaChat}
            className="flex h-9 items-center gap-1.5 rounded-full bg-black/5 px-3.5 text-[15px] font-medium text-acento transition-colors active:bg-black/10"
          >
            <IconoChat className="size-[18px]" />
            Chat
          </Link>
          {salir && (
            <button
              type="button"
              aria-label="Más opciones"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((abierto) => !abierto)}
              className="grid size-9 place-items-center rounded-full text-tinta-suave transition-colors active:bg-black/5"
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

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-[max(env(safe-area-inset-bottom),2.5rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <h1 className="text-[34px] leading-[1.1] font-bold tracking-[-0.025em] sm:text-[40px]">
            {datos && base ? tituloDePeriodo(datos.periodo, datos.desde) : "Panel"}
          </h1>
          <div role="group" aria-label="Período" className="cristal flex rounded-full p-1">
            {PERIODOS.map(([valor, nombre]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={periodo === valor}
                onClick={() => setPeriodo(valor)}
                className={`h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors sm:px-4 ${
                  periodo === valor ? "bg-white text-tinta shadow-[0_1px_3px_rgb(20_30_70/0.16)]" : "text-tinta-suave"
                }`}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="cristal mt-6 max-w-lg rounded-[24px] p-5 text-[15px] leading-snug text-tinta-suave">
            {error}
          </p>
        )}

        {!datos || !base ? (
          !error && <p className="mt-10 text-[15px] text-tinta-suave">Trayendo tus movimientos…</p>
        ) : (
          <div className={`mt-6 transition-opacity duration-200 ${cargando ? "opacity-50" : ""}`} aria-busy={cargando}>
            <Contenido base={base} datos={datos} rutaChat={rutaChat} />
          </div>
        )}
      </main>
    </div>
  );
}

function Contenido({ base, datos, rutaChat }: { base: Base; datos: Datos; rutaChat: string }) {
  const confirmadas = datos.movimientos.filter(cuenta);
  const cuentas = totales(confirmadas);
  const antes = totales(datos.previos.filter(cuenta));
  const cambio = variacion(cuentas.salio, antes.salio);
  const grupos = gastoPorCategoria(confirmadas, base.categorias);
  const personas = transferenciasPorPersona(confirmadas);
  const pendientes = datos.movimientos.filter((t) => t.estado === "en_revision");
  const porMes = datos.periodo === "anio";
  const anterior = periodoAnterior(datos.periodo, base.hoy);

  if (!datos.movimientos.length) {
    return (
      <div className="cristal max-w-lg rounded-[28px] p-6">
        <p className="text-[20px] font-semibold tracking-[-0.01em]">Todavía no hay movimientos en este período</p>
        <p className="mt-1.5 text-[15px] leading-snug text-tinta-suave">Contale a Fia un gasto o mandale una captura, y vas a verlo acá.</p>
        <Link href={rutaChat} className="mt-4 inline-flex h-11 items-center rounded-full bg-acento px-5 text-[16px] font-semibold text-white active:bg-acento-oscuro">
          Abrir el chat
        </Link>
      </div>
    );
  }

  // En el celular todo va en una sola columna, en el orden de lectura. En pantallas anchas
  // se parte en dos columnas independientes, así ninguna tarjeta se estira para emparejar a otra.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <div className="contents lg:col-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        {/* La cifra principal: cuánto salió. */}
        <section className="order-1 min-w-0 cristal rounded-[28px] p-5 sm:p-6">
          <h2 className="text-[15px] text-tinta-suave">Salió</h2>
          <p className="mt-1 text-[48px] leading-none font-bold tracking-[-0.03em] sm:text-[60px]">{formatearImporte(cuentas.salio)}</p>
          <p className="mt-3 flex items-center gap-1.5 text-[15px] text-tinta-suave">
            {cambio === null ? (
              `No hay gastos de ${anterior} para comparar`
            ) : cambio === 0 ? (
              `${cuentas.salio === antes.salio ? "Igual" : "Casi igual"} que en ${anterior}`
            ) : (
              <>
                <span className={`inline-flex items-center gap-1 font-semibold ${cambio > 0 ? "text-rojo" : "text-verde"}`}>
                  <IconoFlecha arriba={cambio > 0} />
                  {Math.abs(cambio)}% {cambio > 0 ? "más" : "menos"}
                </span>
                que en {anterior}
              </>
            )}
          </p>
        </section>
        <section className="order-3 min-w-0 cristal rounded-[28px] p-5 sm:p-6">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{porMes ? "Lo que salió, mes por mes" : "Lo que salió, día por día"}</h2>
          <Barras puntos={serie(confirmadas, datos.desde, datos.hasta, porMes)} porMes={porMes} hoy={base.hoy} />
        </section>
        <Movimientos movimientos={datos.movimientos} categorias={base.categorias} hoy={base.hoy} />
      </div>
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        <div className="order-2 min-w-0 grid grid-cols-2 gap-4">
          <section className="cristal rounded-[28px] p-5">
            <h2 className="text-[15px] text-tinta-suave">Entró</h2>
            <p className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em] break-words">{formatearImporte(cuentas.entro)}</p>
          </section>
          <section className="cristal rounded-[28px] p-5">
            <h2 className="text-[15px] text-tinta-suave">Te queda</h2>
            <p className={`mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em] break-words ${cuentas.queda < 0 ? "text-rojo" : ""}`}>
              {formatearImporte(cuentas.queda)}
            </p>
          </section>
        </div>
        <section className="order-4 min-w-0 cristal rounded-[28px] p-5 sm:p-6">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">En qué se fue</h2>
          <Circular grupos={grupos} total={cuentas.salio} />
        </section>
        {personas.length > 0 && (
          <section className="order-5 min-w-0 cristal rounded-[28px] p-5 sm:p-6">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Transferencias por persona</h2>
            <ul className="mt-2 divide-y divide-linea text-[15px]">
              {personas.slice(0, 8).map((persona) => (
                <li key={persona.nombre} className="py-3">
                  <p className="truncate font-medium">{persona.nombre}</p>
                  <p className="cifras mt-0.5 text-[13px] text-tinta-suave">
                    {[
                      persona.enviado > 0 && `Le enviaste ${formatearImporte(persona.enviado)}`,
                      persona.recibido > 0 && `Te envió ${formatearImporte(persona.recibido)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
            {personas.length > 8 && <p className="mt-2 text-[13px] text-tinta-suave">Y {personas.length - 8} más, en la lista de movimientos.</p>}
          </section>
        )}
        {base.frascos.length > 0 && (
          <section className="order-6 min-w-0 cristal rounded-[28px] p-5 sm:p-6">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Frascos</h2>
            <ul className="mt-4 grid gap-5">
              {base.frascos.map((frasco) => (
                <li key={frasco.id}>
                  <Frasco frasco={frasco} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="order-7 min-w-0 cristal rounded-[28px] p-5 sm:p-6">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Para revisar</h2>
          {pendientes.length ? (
            <>
              <ul className="mt-2 divide-y divide-linea text-[15px]">
                {pendientes.slice(0, 4).map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">{t.descripcion || NOMBRE_DE_TIPO[t.tipo]}</span>
                    <span className="cifras shrink-0 font-medium">{formatearImporte(t.centavos)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] leading-snug text-tinta-suave">
                {pendientes.length === 1 ? "Hay 1 movimiento sin anotar" : `Hay ${pendientes.length} movimientos sin anotar`}: no cuentan hasta que los confirmes.
              </p>
              <Link href={rutaChat} className="mt-3 inline-flex h-10 items-center rounded-full bg-black/5 px-4 text-[15px] font-medium text-acento active:bg-black/10">
                Revisarlos en el chat
              </Link>
            </>
          ) : (
            <p className="mt-3 text-[15px] text-tinta-suave">No hay nada pendiente.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Columnas de lo que salió. Una sola serie, así que no lleva leyenda: el título dice qué es.
 * Al pasar el cursor, enfocar o tocar una columna se ve su valor; la más alta lo lleva escrito.
 */
function Barras({ puntos, porMes, hoy }: { puntos: Punto[]; porMes: boolean; hoy: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const maximo = Math.max(...puntos.map((p) => p.salio));
  const tope = topeRedondo(maximo);
  const elMayor = puntos.findIndex((p) => p.salio === maximo);
  const pocos = puntos.length <= 12;

  if (!tope) return <p className="mt-3 text-[15px] text-tinta-suave">No salió plata en este período.</p>;

  const nombre = (p: Punto) => (porMes ? nombreDeMes(`${p.clave}-01`) : describirFecha(p.clave, hoy));

  return (
    <div className="mt-6">
      <div className="relative h-44 pl-14 sm:h-52" onPointerLeave={(evento) => evento.pointerType === "mouse" && setActivo(null)}>
        {[1, 0.5, 0].map((nivel) => (
          <div key={nivel} className="absolute inset-x-0 flex items-center" style={{ bottom: `${nivel * 100}%` }}>
            <span className="cifras w-14 pr-2 text-right text-[11px] leading-none text-tinta-tenue">{formatearCompacto(tope * nivel)}</span>
            <span className="h-px flex-1 bg-linea" />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-14 flex items-end gap-[2px]">
          {puntos.map((punto, i) => (
            <button
              key={punto.clave}
              type="button"
              aria-label={`${nombre(punto)}: salió ${formatearImporte(punto.salio)}`}
              onPointerEnter={(evento) => evento.pointerType === "mouse" && setActivo(i)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              onClick={() => setActivo((previo) => (previo === i ? null : i))}
              className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-md outline-offset-0"
            >
              <span
                className={`w-full max-w-6 rounded-t-[4px] transition-colors ${activo === i ? "bg-acento-oscuro" : "bg-acento"}`}
                style={{ height: `${(punto.salio / tope) * 100}%` }}
              />
              {activo === null && i === elMayor && (
                <span
                  className={`cifras pointer-events-none absolute text-[12px] font-medium whitespace-nowrap text-tinta ${
                    i < puntos.length / 2 ? "left-0" : "right-0"
                  }`}
                  style={{ bottom: `calc(${(punto.salio / tope) * 100}% + 4px)` }}
                >
                  {formatearImporte(punto.salio)}
                </span>
              )}
              {activo === i && (
                <span
                  role="tooltip"
                  className={`cristal pointer-events-none absolute z-10 rounded-xl px-2.5 py-1.5 text-left whitespace-nowrap ${
                    i < puntos.length / 2 ? "left-0" : "right-0"
                  }`}
                  style={{ bottom: `calc(${(punto.salio / tope) * 100}% + 6px)` }}
                >
                  <span className="cifras block text-[15px] leading-tight font-semibold text-tinta">{formatearImporte(punto.salio)}</span>
                  <span className="block text-[12px] leading-tight text-tinta-suave">{nombre(punto)}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pl-14" aria-hidden="true">
        {puntos.map((punto, i) => (
          <span key={punto.clave} className="cifras min-w-0 flex-1 text-center text-[11px] text-tinta-tenue">
            {pocos || i === 0 || Number(punto.etiqueta) % 5 === 0 ? punto.etiqueta : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const RADIO = 46;
const GROSOR = 15;
const VUELTA = 2 * Math.PI * RADIO;

/**
 * Reparto de lo que salió por tipo de operación. Como mucho seis porciones, cada una con el
 * color fijo de su categoría. La lista de abajo es la leyenda y lleva los valores escritos,
 * así nada depende solo del color.
 */
function Circular({ grupos, total }: { grupos: GrupoDeGasto[]; total: number }) {
  const [activa, setActiva] = useState<string | null>(null);
  const partes = porciones(grupos);
  if (!partes.length || total <= 0) return <p className="mt-3 text-[15px] text-tinta-suave">No salió plata en este período.</p>;

  // Entre porción y porción queda un hueco fino del color de la tarjeta.
  const hueco = partes.length > 1 ? 1.6 : 0;
  const arcos = partes.map((parte, i) => {
    const antes = partes.slice(0, i).reduce((suma, p) => suma + p.centavos, 0);
    const largo = Math.max((parte.centavos / total) * VUELTA - hueco, 0.8);
    return { ...parte, largo, inicio: (antes / total) * VUELTA + hueco / 2 };
  });
  const elegida = partes.find((p) => p.clave === activa);
  const cifra = formatearImporte(elegida ? elegida.centavos : total);
  const porcentaje = (parte: number) => (parte < 0.01 ? "<1%" : `${Math.round(parte * 100)}%`);

  const alPasar = (clave: string | null) => (evento: React.PointerEvent) => evento.pointerType === "mouse" && setActiva(clave);
  const alTocar = (clave: string) => () => setActiva((previa) => (previa === clave ? null : clave));

  return (
    <>
      <div className="relative mx-auto mt-5 size-44">
        <svg viewBox="0 0 120 120" className="size-full" role="img" aria-label="Reparto de lo que salió, por tipo de operación">
          <g transform="rotate(-90 60 60)">
            {arcos.map((arco) => (
              <circle
                key={arco.clave}
                cx="60"
                cy="60"
                r={RADIO}
                fill="none"
                stroke={arco.color}
                strokeWidth={activa === arco.clave ? GROSOR + 3 : GROSOR}
                strokeDasharray={`${arco.largo} ${VUELTA - arco.largo}`}
                strokeDashoffset={-arco.inicio}
                opacity={activa && activa !== arco.clave ? 0.3 : 1}
                className="cursor-pointer transition-[opacity,stroke-width] duration-150"
                onPointerEnter={alPasar(arco.clave)}
                onPointerLeave={alPasar(null)}
                onClick={alTocar(arco.clave)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-live="polite">
          <div className="max-w-[6.5rem] text-center">
            <p className="text-[12px] leading-tight text-tinta-suave">{elegida ? elegida.nombre : "Salió"}</p>
            <p className="mt-0.5 text-[18px] leading-tight font-semibold tracking-[-0.02em]">
              {cifra.length > 9 ? formatearCompacto(elegida ? elegida.centavos : total) : cifra}
            </p>
            {elegida && <p className="cifras text-[12px] leading-tight text-tinta-suave">{porcentaje(elegida.parte)}</p>}
          </div>
        </div>
      </div>

      <ul className="-mx-2 mt-4 flex flex-col gap-0.5">
        {[...partes]
          .sort((a, b) => b.centavos - a.centavos)
          .map((parte) => (
            <li key={parte.clave}>
              <button
                type="button"
                aria-pressed={activa === parte.clave}
                onPointerEnter={alPasar(parte.clave)}
                onPointerLeave={alPasar(null)}
                onFocus={() => setActiva(parte.clave)}
                onBlur={() => setActiva(null)}
                onClick={alTocar(parte.clave)}
                className={`flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left text-[15px] transition-colors ${
                  activa === parte.clave ? "bg-black/5" : ""
                }`}
              >
                <span aria-hidden="true" className="mt-[5px] size-3 shrink-0 rounded-[4px]" style={{ background: parte.color }} />
                {/* El nombre entero, en dos renglones si hace falta: cortado, "débito" y "crédito" se verían iguales. */}
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug">{parte.nombre}</span>
                  <span className="cifras block text-[12px] leading-snug text-tinta-suave">{porcentaje(parte.parte)} de lo que salió</span>
                </span>
                <span className="cifras shrink-0 font-medium">{formatearImporte(parte.centavos)}</span>
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}

function Movimientos({ movimientos, categorias, hoy }: { movimientos: Transaccion[]; categorias: Categoria[]; hoy: string }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [verDescartados, setVerDescartados] = useState(false);

  const nombreDe = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? "Sin clasificar";
  const buscado = busqueda.trim().toLocaleLowerCase("es-AR");

  const filas = movimientos.filter((t) => {
    if (!verDescartados && (t.estado === "rechazada" || t.estado === "anulada")) return false;
    const esTransferencia = t.tipo === "transferencia_enviada" || t.tipo === "transferencia_recibida";
    if (filtro === "transferencias" && !esTransferencia) return false;
    if (filtro === "gastos" && t.tipo !== "gasto") return false;
    if (filtro === "ingresos" && t.tipo !== "ingreso") return false;
    if (!buscado) return true;
    return `${t.descripcion} ${t.contraparte ?? ""} ${nombreDe(t.categoriaId)}`.toLocaleLowerCase("es-AR").includes(buscado);
  });
  const visibles = filas.slice(0, FILAS_VISIBLES);

  return (
    <section className="cristal order-8 min-w-0 rounded-[28px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Movimientos</h2>
        <label className="sr-only" htmlFor="buscar-movimiento">
          Buscar en los movimientos
        </label>
        <input
          id="buscar-movimiento"
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar"
          className="h-10 w-full rounded-full border border-black/8 bg-white/70 px-4 text-[16px] outline-none placeholder:text-tinta-tenue focus:border-acento focus:ring-2 focus:ring-acento/20 sm:w-64"
        />
      </div>

      <div className="sin-barra -mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        {FILTROS.map(([valor, nombre]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={filtro === valor}
            onClick={() => setFiltro(valor)}
            className={`h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium transition-colors ${
              filtro === valor ? "bg-tinta text-white" : "bg-black/5 text-tinta-suave"
            }`}
          >
            {nombre}
          </button>
        ))}
        <label className="ml-auto flex h-9 shrink-0 items-center gap-2 pl-2 text-[14px] text-tinta-suave">
          <input type="checkbox" checked={verDescartados} onChange={(evento) => setVerDescartados(evento.target.checked)} className="size-4 accent-acento" />
          Ver anulados
        </label>
      </div>

      {visibles.length ? (
        <ul className="mt-2 divide-y divide-linea">
          {visibles.map((t) => (
            <li
              key={t.id}
              className={`grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3 md:grid-cols-[5rem_1fr_11rem_auto] ${
                t.estado === "anulada" || t.estado === "rechazada" ? "opacity-55" : ""
              }`}
            >
              <span className="cifras hidden text-[14px] text-tinta-suave md:block">{t.fecha === hoy ? "Hoy" : fechaCorta(t.fecha)}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-medium">
                  <span className="min-w-0 truncate">{t.descripcion || NOMBRE_DE_TIPO[t.tipo]}</span>
                  {t.estado !== "confirmada" && <Estado transaccion={t} />}
                </p>
                <p className="mt-0.5 text-[13px] text-tinta-suave">
                  <span className="md:hidden">{t.fecha === hoy ? "Hoy" : fechaCorta(t.fecha)} · </span>
                  {NOMBRE_DE_TIPO[t.tipo]}
                  {t.interna ? " · entre tus cuentas" : ""}
                  {t.metodo === "imagen" ? " · de una captura" : ""}
                  <span className="md:hidden"> · {nombreDe(t.categoriaId)}</span>
                </p>
              </div>
              <span className="hidden truncate text-[14px] text-tinta-suave md:block">{nombreDe(t.categoriaId)}</span>
              <Importe transaccion={t} className={`cifras text-[16px] font-medium ${t.estado === "anulada" ? "line-through" : ""}`} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[15px] text-tinta-suave">Ningún movimiento coincide con ese filtro.</p>
      )}
      {filas.length > visibles.length && (
        <p className="mt-3 text-[13px] text-tinta-suave">
          Se muestran los {visibles.length} más recientes de {filas.length}. Usá el buscador o los filtros para achicar la lista.
        </p>
      )}
    </section>
  );
}
