"use client";

import { useId, useState } from "react";
import type { CambiosDeEdicion } from "@/lib/fia/conversacion";
import type { Categoria } from "@/lib/motor/categorias";
import { describirFecha } from "@/lib/motor/fechas";
import { buscarImportes, formatearImporte } from "@/lib/motor/importes";
import type { FrascoConocido, Tipo } from "@/lib/motor/interpretar";
import { plano } from "@/lib/motor/texto";
import { ES_ENTRADA, NOMBRE_DE_TIPO, type Aviso, type Transaccion } from "@/lib/tipos";

export type AccionesDeTicket = {
  confirmar: (id: string) => void;
  descartar: (id: string) => void;
  anular: (id: string) => void;
  editar: (id: string, cambios: CambiosDeEdicion, yaAnotado: boolean) => void;
};

type Props = {
  transaccion: Transaccion;
  categorias: Categoria[];
  frascos: FrascoConocido[];
  hoy: string;
  avisos?: Aviso[];
  ocupado: boolean;
  animar: boolean;
  acciones: AccionesDeTicket;
};

const TIPOS = Object.keys(NOMBRE_DE_TIPO) as Tipo[];

const TEXTO_DE_AVISO: Record<Aviso, string> = {
  sentido: "Decime si la enviaste o la recibiste",
  importe_dudoso: "Revisá el importe",
  sin_fecha: "No vi la fecha: le puse hoy",
  duplicado: "Parece repetido",
  propia: "Es entre tus cuentas: no cuenta en los totales",
};

/** El importe con su signo: verde y con "+" cuando entra plata. */
export function Importe({ transaccion, neutro = false, className = "" }: { transaccion: Transaccion; neutro?: boolean; className?: string }) {
  const entra = ES_ENTRADA[transaccion.tipo] && !neutro && !transaccion.interna;
  return (
    <span className={`${entra ? "text-verde" : "text-tinta"} ${className}`}>
      {entra ? "+" : ""}
      {formatearImporte(transaccion.centavos)}
    </span>
  );
}

/** Marca de estado, arriba a la derecha de la tarjeta. */
export function Estado({ transaccion }: { transaccion: Transaccion }) {
  if (transaccion.estado === "confirmada") {
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-verde/12 px-2 text-[12px] font-semibold text-verde">
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
        Anotado
      </span>
    );
  }
  const texto = { anulada: "Anulado", rechazada: "Descartado", en_revision: "Para revisar", recibida: "Recibido" }[transaccion.estado];
  return <span className="inline-flex h-6 items-center rounded-full bg-black/6 px-2 text-[12px] font-medium text-tinta-suave">{texto}</span>;
}

/** Un movimiento, en una tarjeta de vidrio para revisar y anotar. */
export function Ticket({ transaccion: t, categorias, frascos, hoy, avisos = [], ocupado, animar, acciones }: Props) {
  const [editando, setEditando] = useState(false);
  const categoria = categorias.find((c) => c.id === t.categoriaId)?.nombre;
  const frasco = frascos.find((f) => f.id === t.frascoId)?.nombre;
  const apagado = t.estado === "rechazada" || t.estado === "anulada";
  const pendiente = t.estado === "en_revision";
  // Mientras no se sepa si la plata entró o salió, no se muestra como ninguna de las dos.
  const faltaSentido = pendiente && avisos.includes("sentido");
  const visibles = pendiente ? avisos : avisos.filter((aviso) => aviso === "propia");

  return (
    <article className={`cristal w-full max-w-[22rem] rounded-[24px] p-4 ${animar ? "animate-aparecer" : ""} ${apagado ? "opacity-60" : ""}`}>
      {editando ? (
        <Formulario
          transaccion={t}
          categorias={categorias}
          frascos={frascos}
          hoy={hoy}
          ocupado={ocupado}
          alCancelar={() => setEditando(false)}
          alGuardar={(cambios) => {
            acciones.editar(t.id, cambios, t.estado === "confirmada");
            setEditando(false);
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-tinta-suave">
              {faltaSentido ? "Transferencia" : NOMBRE_DE_TIPO[t.tipo]} · {describirFecha(t.fecha, hoy)}
            </p>
            {!pendiente && <Estado transaccion={t} />}
          </div>

          <p className="mt-1">
            <Importe
              transaccion={t}
              neutro={faltaSentido}
              className={`text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] ${t.estado === "anulada" ? "line-through" : ""}`}
            />
          </p>
          <p className="mt-2 text-[17px] leading-snug font-medium break-words">{t.descripcion || "Sin detalle"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-tinta-suave">
            <span className={categoria ? "" : "text-tinta-tenue"}>{categoria ?? "Sin clasificar"}</span>
            {frasco && <span className="rounded-full bg-acento/10 px-2 py-0.5 text-[13px] font-medium text-acento">Frasco {frasco}</span>}
          </p>

          {visibles.length > 0 && (
            <ul className="mt-2.5 grid gap-1 text-[13px] leading-snug">
              {visibles.map((aviso) => (
                <li key={aviso} className={`flex items-start gap-1.5 ${aviso === "propia" ? "text-tinta-suave" : "text-rojo"}`}>
                  <span aria-hidden="true" className="mt-[5px] size-1.5 shrink-0 rounded-full bg-current" />
                  {TEXTO_DE_AVISO[aviso]}
                </li>
              ))}
            </ul>
          )}

          {(pendiente || t.estado === "confirmada") && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[15px]">
              {pendiente && faltaSentido && (
                <>
                  <BotonPrincipal disabled={ocupado} onClick={() => acciones.editar(t.id, { tipo: "transferencia_enviada" }, false)}>
                    La envié
                  </BotonPrincipal>
                  <BotonPrincipal disabled={ocupado} onClick={() => acciones.editar(t.id, { tipo: "transferencia_recibida" }, false)}>
                    La recibí
                  </BotonPrincipal>
                </>
              )}
              {pendiente && !faltaSentido && (
                <BotonPrincipal disabled={ocupado} onClick={() => acciones.confirmar(t.id)}>
                  {avisos.includes("duplicado") ? "Anotar igual" : "Anotar"}
                </BotonPrincipal>
              )}
              <BotonSuave disabled={ocupado} onClick={() => setEditando(true)}>
                Editar
              </BotonSuave>
              {pendiente ? (
                <BotonSuave disabled={ocupado} onClick={() => acciones.descartar(t.id)}>
                  Descartar
                </BotonSuave>
              ) : (
                <BotonSuave disabled={ocupado} onClick={() => acciones.anular(t.id)}>
                  Anular
                </BotonSuave>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function BotonPrincipal(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="h-10 rounded-full bg-acento px-5 font-semibold text-white transition-colors active:bg-acento-oscuro disabled:opacity-50"
    />
  );
}

export function BotonSuave(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="h-10 rounded-full bg-black/5 px-4 font-medium text-acento transition-colors active:bg-black/10 disabled:opacity-50"
    />
  );
}

/** Valor del desplegable que abre el campo para crear una categoría propia. */
const CATEGORIA_NUEVA = "__nueva__";

const CAMPO =
  "h-11 w-full rounded-xl border border-black/8 bg-white/80 px-3 text-[16px] text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/20";

function Formulario({
  transaccion: t,
  categorias,
  frascos,
  hoy,
  ocupado,
  alGuardar,
  alCancelar,
}: {
  transaccion: Transaccion;
  categorias: Categoria[];
  frascos: FrascoConocido[];
  hoy: string;
  ocupado: boolean;
  alGuardar: (cambios: CambiosDeEdicion) => void;
  alCancelar: () => void;
}) {
  const id = useId();
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [tipo, setTipo] = useState<Tipo>(t.tipo);
  const [importe, setImporte] = useState(formatearImporte(t.centavos).replace("$", ""));
  const [categoriaId, setCategoriaId] = useState(t.categoriaId ?? "");
  const [frascoId, setFrascoId] = useState(t.frascoId ?? "");
  const [descripcion, setDescripcion] = useState(t.descripcion);
  const [fecha, setFecha] = useState(t.fecha);
  const [interna, setInterna] = useState(t.interna);
  const [error, setError] = useState("");

  function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    const leidos = buscarImportes(plano(importe));
    if (leidos.length !== 1) {
      setError("Escribí el importe solo con números, por ejemplo 4.500");
      return;
    }
    if (!fecha || fecha > hoy) {
      setError("La fecha no puede ser posterior a hoy");
      return;
    }
    if (categoriaId === CATEGORIA_NUEVA && !categoriaNueva.trim()) {
      setError("Ponele un nombre a la categoría nueva");
      return;
    }
    alGuardar({
      tipo,
      centavos: leidos[0].centavos,
      ...(categoriaId === CATEGORIA_NUEVA ? { categoriaNueva: categoriaNueva.trim() } : { categoriaId: categoriaId || null }),
      // Un frasco solo descuenta plata que sale de verdad.
      frascoId: ES_ENTRADA[tipo] || interna ? null : frascoId || null,
      descripcion: descripcion.trim(),
      fecha,
      interna,
    });
  }

  return (
    <form onSubmit={guardar} className="grid gap-3 text-[13px] text-tinta-suave">
      <label htmlFor={`${id}-importe`} className="grid gap-1">
        Importe
        <input id={`${id}-importe`} inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} className={CAMPO} />
      </label>
      <label htmlFor={`${id}-detalle`} className="grid gap-1">
        Detalle
        <input id={`${id}-detalle`} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={CAMPO} />
      </label>
      <label htmlFor={`${id}-categoria`} className="grid gap-1">
        Categoría
        <select id={`${id}-categoria`} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={CAMPO}>
          <option value="">Sin clasificar</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
          <option value={CATEGORIA_NUEVA}>Nueva categoría…</option>
        </select>
      </label>
      {categoriaId === CATEGORIA_NUEVA && (
        <label htmlFor={`${id}-nueva`} className="grid gap-1">
          Nombre de la categoría nueva
          <input id={`${id}-nueva`} value={categoriaNueva} onChange={(e) => setCategoriaNueva(e.target.value)} maxLength={40} className={CAMPO} />
        </label>
      )}
      {frascos.length > 0 && !ES_ENTRADA[tipo] && !interna && (
        <label htmlFor={`${id}-frasco`} className="grid gap-1">
          Frasco
          <select id={`${id}-frasco`} value={frascoId} onChange={(e) => setFrascoId(e.target.value)} className={CAMPO}>
            <option value="">Ninguno</option>
            {frascos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${id}-tipo`} className="grid gap-1">
          Tipo
          <select id={`${id}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className={CAMPO}>
            {TIPOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {NOMBRE_DE_TIPO[opcion]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-fecha`} className="grid gap-1">
          Fecha
          <input id={`${id}-fecha`} type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
        </label>
      </div>
      <label htmlFor={`${id}-interna`} className="flex min-h-11 items-center gap-2.5 text-[15px] text-tinta">
        <input
          id={`${id}-interna`}
          type="checkbox"
          checked={interna}
          onChange={(e) => setInterna(e.target.checked)}
          className="size-5 accent-acento"
        />
        Es entre mis cuentas (no cuenta en los totales)
      </label>

      {error && (
        <p role="alert" className="text-rojo">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 text-[15px]">
        <button
          type="submit"
          disabled={ocupado}
          className="h-10 rounded-full bg-acento px-5 font-semibold text-white active:bg-acento-oscuro disabled:opacity-50"
        >
          {t.estado === "confirmada" ? "Guardar" : "Anotar"}
        </button>
        <BotonSuave onClick={alCancelar}>Cancelar</BotonSuave>
      </div>
    </form>
  );
}
