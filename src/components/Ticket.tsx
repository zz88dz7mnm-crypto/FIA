"use client";

import { useId, useState } from "react";
import type { CambiosTransaccion } from "@/lib/datos/repositorio";
import type { Categoria } from "@/lib/motor/categorias";
import { describirFecha } from "@/lib/motor/fechas";
import { buscarImportes, formatearImporte } from "@/lib/motor/importes";
import type { Tipo } from "@/lib/motor/interpretar";
import { plano } from "@/lib/motor/texto";
import { ES_ENTRADA, NOMBRE_DE_TIPO, type Transaccion } from "@/lib/tipos";

export type AccionesDeTicket = {
  confirmar: (id: string) => void;
  descartar: (id: string) => void;
  anular: (id: string) => void;
  editar: (id: string, cambios: Omit<CambiosTransaccion, "estado">, yaAnotado: boolean) => void;
};

type Props = {
  transaccion: Transaccion;
  categorias: Categoria[];
  hoy: string;
  aviso?: "duplicado" | "importe_dudoso";
  ocupado: boolean;
  animar: boolean;
  acciones: AccionesDeTicket;
};

const TIPOS = Object.keys(NOMBRE_DE_TIPO) as Tipo[];

export function Sello({ texto, tono }: { texto: string; tono: "birome" | "rojo" }) {
  return (
    <span
      className={`animate-sello pointer-events-none absolute top-3 right-3 -rotate-[8deg] rounded-[5px] border-2 px-2 py-0.5 font-display text-[13px] font-extrabold tracking-[0.14em] ${
        tono === "birome" ? "border-birome text-birome" : "border-rojo text-rojo"
      }`}
    >
      {texto}
    </span>
  );
}

export function Importe({ transaccion, className = "" }: { transaccion: Transaccion; className?: string }) {
  const entra = ES_ENTRADA[transaccion.tipo];
  return (
    <span className={`font-mono font-medium tabular-nums ${entra ? "text-verde" : "text-tinta"} ${className}`}>
      {entra ? "+" : ""}
      {formatearImporte(transaccion.centavos)}
    </span>
  );
}

/** Un movimiento, dibujado como el ticket que Fia te alcanza para revisar. */
export function Ticket({ transaccion: t, categorias, hoy, aviso, ocupado, animar, acciones }: Props) {
  const [editando, setEditando] = useState(false);
  const categoria = categorias.find((c) => c.id === t.categoriaId)?.nombre;
  const apagado = t.estado === "rechazada" || t.estado === "anulada";

  return (
    <div className={`sombra-ticket w-full max-w-[19rem] ${animar ? "animate-imprimir" : ""}`}>
      <article className={`troquel relative rounded-t-md bg-ticket px-4 pt-3.5 ${apagado ? "opacity-60" : ""}`}>
        {t.estado === "confirmada" && !editando && <Sello texto="ANOTADO" tono="birome" />}
        {t.estado === "anulada" && <Sello texto="ANULADO" tono="rojo" />}

        {editando ? (
          <Formulario
            transaccion={t}
            categorias={categorias}
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
            <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-tinta-suave uppercase">
              {NOMBRE_DE_TIPO[t.tipo]} · {describirFecha(t.fecha, hoy)}
            </p>
            <p className="mt-1.5">
              <Importe transaccion={t} className={`text-[2rem] leading-none ${t.estado === "anulada" ? "line-through" : ""}`} />
            </p>
            <p className="mt-2.5 text-[15px] leading-snug font-medium break-words">{t.descripcion || "Sin detalle"}</p>
            <p className={`text-[13px] ${categoria ? "text-tinta-suave" : "text-rojo"}`}>{categoria ?? "Sin clasificar"}</p>

            {aviso && t.estado === "en_revision" && (
              <p className="mt-2 border-l-2 border-rojo pl-2 text-[13px] leading-snug text-rojo">
                {aviso === "duplicado" ? "Parece repetido" : "Revisá el importe"}
              </p>
            )}

            <div className="mt-3 flex min-h-11 items-center gap-1 border-t border-dashed border-linea pt-2 text-[14px]">
              {t.estado === "en_revision" && (
                <>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => acciones.confirmar(t.id)}
                    className="h-10 rounded-full bg-birome px-5 font-semibold text-white transition-colors active:bg-birome-oscuro disabled:opacity-50"
                  >
                    {aviso === "duplicado" ? "Anotar igual" : "Anotar"}
                  </button>
                  <BotonDeTexto disabled={ocupado} onClick={() => setEditando(true)}>
                    Editar
                  </BotonDeTexto>
                  <BotonDeTexto disabled={ocupado} onClick={() => acciones.descartar(t.id)}>
                    Descartar
                  </BotonDeTexto>
                </>
              )}
              {t.estado === "confirmada" && (
                <>
                  <BotonDeTexto disabled={ocupado} onClick={() => setEditando(true)}>
                    Editar
                  </BotonDeTexto>
                  <BotonDeTexto disabled={ocupado} onClick={() => acciones.anular(t.id)}>
                    Anular
                  </BotonDeTexto>
                </>
              )}
              {t.estado === "rechazada" && <span className="px-1 text-tinta-suave">Descartado</span>}
              {t.estado === "anulada" && <span className="px-1 text-tinta-suave">No cuenta en tus totales</span>}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function BotonDeTexto(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="h-10 rounded-full px-3 font-medium text-birome transition-colors active:bg-birome/10 disabled:opacity-50"
    />
  );
}

const CAMPO =
  "h-11 w-full rounded-lg border border-linea bg-white px-3 text-[16px] text-tinta outline-none focus:border-birome focus:ring-2 focus:ring-birome/20";

function Formulario({
  transaccion: t,
  categorias,
  hoy,
  ocupado,
  alGuardar,
  alCancelar,
}: {
  transaccion: Transaccion;
  categorias: Categoria[];
  hoy: string;
  ocupado: boolean;
  alGuardar: (cambios: Omit<CambiosTransaccion, "estado">) => void;
  alCancelar: () => void;
}) {
  const id = useId();
  const [tipo, setTipo] = useState<Tipo>(t.tipo);
  const [importe, setImporte] = useState(formatearImporte(t.centavos).replace("$", ""));
  const [categoriaId, setCategoriaId] = useState(t.categoriaId ?? "");
  const [descripcion, setDescripcion] = useState(t.descripcion);
  const [fecha, setFecha] = useState(t.fecha);
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
    alGuardar({ tipo, centavos: leidos[0].centavos, categoriaId: categoriaId || null, descripcion: descripcion.trim(), fecha });
  }

  return (
    <form onSubmit={guardar} className="grid gap-2.5 pb-1 text-[13px] text-tinta-suave">
      <label htmlFor={`${id}-importe`} className="grid gap-1">
        Importe
        <input
          id={`${id}-importe`}
          inputMode="decimal"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          className={`${CAMPO} font-mono`}
        />
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
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2.5">
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

      {error && (
        <p role="alert" className="text-rojo">
          {error}
        </p>
      )}

      <div className="mt-1 flex items-center gap-1 border-t border-dashed border-linea pt-2 text-[14px]">
        <button
          type="submit"
          disabled={ocupado}
          className="h-10 rounded-full bg-birome px-5 font-semibold text-white active:bg-birome-oscuro disabled:opacity-50"
        >
          {t.estado === "confirmada" ? "Guardar" : "Anotar"}
        </button>
        <BotonDeTexto onClick={alCancelar}>Cancelar</BotonDeTexto>
      </div>
    </form>
  );
}
