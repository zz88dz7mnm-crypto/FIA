import { tituloDePeriodo } from "@/lib/fia/voz";
import type { Categoria } from "@/lib/motor/categorias";
import { describirFecha } from "@/lib/motor/fechas";
import { formatearImporte } from "@/lib/motor/importes";
import type { EstadoFrasco, Resumen, Transaccion } from "@/lib/tipos";
import { Importe } from "./Ticket";

/** Renglón de cuenta: concepto a la izquierda, importe alineado a la derecha. */
function Renglon({ concepto, children, fuerte = false }: { concepto: string; children: React.ReactNode; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${fuerte ? "text-[17px] font-semibold" : ""}`}>
      <span className="min-w-0 truncate">{concepto}</span>
      <span className="cifras shrink-0">{children}</span>
    </div>
  );
}

function Tarjeta({ titulo, animar, children }: { titulo: string; animar: boolean; children: React.ReactNode }) {
  return (
    <section className={`cristal w-full max-w-[22rem] rounded-[24px] p-4 text-[15px] ${animar ? "animate-aparecer" : ""}`}>
      <h3 className="text-[13px] text-tinta-suave">{titulo}</h3>
      {children}
    </section>
  );
}

export function TicketResumen({ resumen, animar }: { resumen: Resumen; animar: boolean }) {
  const queda = resumen.entradas - resumen.salidas;
  return (
    <Tarjeta titulo={tituloDePeriodo(resumen.periodo, resumen.desde)} animar={animar}>
      <div className="mt-1 divide-y divide-linea">
        <Renglon concepto="Entró">
          <span className="text-verde">{formatearImporte(resumen.entradas)}</span>
        </Renglon>
        <Renglon concepto="Salió">{formatearImporte(resumen.salidas)}</Renglon>
        <Renglon concepto="Te queda" fuerte>
          <span className={queda < 0 ? "text-rojo" : ""}>{formatearImporte(queda)}</span>
        </Renglon>
      </div>
      {resumen.porCategoria.length > 0 && (
        <div className="mt-3 divide-y divide-linea border-t border-linea text-tinta-suave">
          {resumen.porCategoria.map((grupo) => (
            <Renglon key={grupo.nombre} concepto={grupo.nombre}>
              {formatearImporte(grupo.centavos)}
            </Renglon>
          ))}
        </div>
      )}
    </Tarjeta>
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
    <Tarjeta titulo="Últimos movimientos" animar={animar}>
      <ul className="mt-1 divide-y divide-linea">
        {transacciones.map((t) => {
          const categoria = categorias.find((c) => c.id === t.categoriaId)?.nombre ?? "Sin clasificar";
          return (
            <li key={t.id} className={`flex items-baseline gap-3 py-2.5 ${t.estado === "anulada" ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-tinta">{t.descripcion || categoria}</p>
                <p className="text-[13px] text-tinta-suave">
                  {describirFecha(t.fecha, hoy)} · {t.estado === "anulada" ? "Anulado" : categoria}
                </p>
              </div>
              <Importe transaccion={t} className={`cifras font-medium ${t.estado === "anulada" ? "line-through" : ""}`} />
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

/** Un frasco: cuánto le queda y una barra de cuánto se usó. */
export function Frasco({ frasco }: { frasco: EstadoFrasco }) {
  const queda = frasco.asignado - frasco.gastado;
  const usado = frasco.asignado > 0 ? Math.min(100, Math.round((frasco.gastado / frasco.asignado) * 100)) : frasco.gastado > 0 ? 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[16px] font-semibold text-tinta">{frasco.nombre}</span>
        <span className={`cifras text-[16px] font-semibold ${queda < 0 ? "text-rojo" : "text-tinta"}`}>{formatearImporte(queda)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-acento/15" role="img" aria-label={`Usaste el ${usado}% del frasco`}>
        <div className={`h-full rounded-full ${queda < 0 ? "bg-rojo" : "bg-acento"}`} style={{ width: `${usado}%` }} />
      </div>
      <p className="mt-1.5 text-[13px] text-tinta-suave">
        {queda < 0 ? "Te pasaste. " : ""}Gastaste {formatearImporte(frasco.gastado)} de {formatearImporte(frasco.asignado)}
      </p>
    </div>
  );
}

export function TicketFrascos({ frascos, animar }: { frascos: EstadoFrasco[]; animar: boolean }) {
  return (
    <Tarjeta titulo={frascos.length === 1 ? "Frasco" : "Frascos"} animar={animar}>
      <ul className="mt-2.5 grid gap-4">
        {frascos.map((frasco) => (
          <li key={frasco.id}>
            <Frasco frasco={frasco} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
