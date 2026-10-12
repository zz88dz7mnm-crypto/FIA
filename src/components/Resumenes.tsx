import type { Categoria } from "@/lib/motor/categorias";
import { describirFecha } from "@/lib/motor/fechas";
import { formatearImporte } from "@/lib/motor/importes";
import { tituloDePeriodo } from "@/lib/fia/voz";
import type { Resumen, Transaccion } from "@/lib/tipos";
import { Importe } from "./Ticket";

/** Renglón de ticket: concepto a la izquierda, importe a la derecha y puntos de guía en el medio. */
function Renglon({ concepto, children, fuerte = false }: { concepto: string; children: React.ReactNode; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${fuerte ? "font-semibold" : ""}`}>
      <span className="min-w-0 truncate">{concepto}</span>
      <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-linea" />
      <span className="font-mono tabular-nums">{children}</span>
    </div>
  );
}

function Marco({ titulo, animar, children }: { titulo: string; animar: boolean; children: React.ReactNode }) {
  return (
    <div className={`sombra-ticket w-full max-w-[19rem] ${animar ? "animate-imprimir" : ""}`}>
      <section className="troquel rounded-t-md bg-ticket px-4 pt-3.5 text-[14px]">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.12em] text-tinta-suave uppercase">{titulo}</h3>
        {children}
      </section>
    </div>
  );
}

export function TicketResumen({ resumen, animar }: { resumen: Resumen; animar: boolean }) {
  const balance = resumen.entradas - resumen.salidas;
  return (
    <Marco titulo={tituloDePeriodo(resumen.periodo, resumen.desde)} animar={animar}>
      <div className="mt-2.5 grid gap-1.5">
        <Renglon concepto="Entró">
          <span className="text-verde">{formatearImporte(resumen.entradas)}</span>
        </Renglon>
        <Renglon concepto="Salió">{formatearImporte(resumen.salidas)}</Renglon>
      </div>
      <div className="mt-2.5 border-t border-dashed border-linea pt-2.5 text-[16px]">
        <Renglon concepto="Te queda" fuerte>
          <span className={balance < 0 ? "text-rojo" : ""}>{formatearImporte(balance)}</span>
        </Renglon>
      </div>
      {resumen.porCategoria.length > 0 && (
        <div className="mt-3 grid gap-1.5 border-t border-dashed border-linea pt-2.5 pb-1 text-tinta-suave">
          {resumen.porCategoria.map((grupo) => (
            <Renglon key={grupo.nombre} concepto={grupo.nombre}>
              {formatearImporte(grupo.centavos)}
            </Renglon>
          ))}
        </div>
      )}
    </Marco>
  );
}

export function TicketLista({
  transacciones,
  categorias,
  hoy,
  animar,
}: {
  transacciones: Transaccion[];
  categorias: Categoria[];
  hoy: string;
  animar: boolean;
}) {
  return (
    <Marco titulo="Últimos movimientos" animar={animar}>
      <ul className="mt-2 divide-y divide-dashed divide-linea pb-1">
        {transacciones.map((t) => {
          const categoria = categorias.find((c) => c.id === t.categoriaId)?.nombre ?? "Sin clasificar";
          return (
            <li key={t.id} className={`flex items-baseline gap-3 py-2 ${t.estado === "anulada" ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.descripcion || categoria}</p>
                <p className="text-[12px] text-tinta-suave">
                  {describirFecha(t.fecha, hoy)} · {t.estado === "anulada" ? "Anulado" : categoria}
                </p>
              </div>
              <Importe transaccion={t} className={t.estado === "anulada" ? "line-through" : ""} />
            </li>
          );
        })}
      </ul>
    </Marco>
  );
}
