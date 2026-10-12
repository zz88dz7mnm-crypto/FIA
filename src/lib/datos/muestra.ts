import { hoyEn } from "../fia/conversacion";
import { sumarDias } from "../motor/fechas";
import type { Tipo } from "../motor/interpretar";
import { repositorioEnMemoria } from "./memoria";
import type { Repositorio } from "./repositorio";

type Semilla = [diasAtras: number, tipo: Tipo, pesos: number, detalle: string, categoria: string | null, extra?: "interna" | "pendiente" | "anulada" | "frasco"];

// Dos meses de movimientos inventados, para ver el panel con algo adentro.
const SEMILLAS: Semilla[] = [
  [0, "gasto", 8200, "Almuerzo", "debito"],
  [0, "gasto", 3100, "Carga SUBE", "servicios"],
  [1, "gasto", 12500, "Cp*pack Claro", "debito"],
  [1, "transferencia_enviada", 1200, "Valentin Torres Gaitan", "transferencias"],
  [2, "gasto", 23900, "Supermercado", "debito"],
  [2, "ingreso", 2, "Rendimiento diario", "rendimientos"],
  [3, "gasto", 6400, "Apuntes de la facu", "qr", "frasco"],
  [3, "transferencia_enviada", 40000, "Fondo", "propias", "interna"],
  [4, "gasto", 15800, "Cena con amigos", "credito"],
  [5, "transferencia_enviada", 18000, "Marta Suarez", "transferencias"],
  [5, "gasto", 4200, "Kiosco El Sol", "qr"],
  [6, "gasto", 9800, "Farmacia", "debito"],
  [7, "gasto", 11200, "Cine", "credito"],
  [8, "transferencia_recibida", 25000, "Pedro Gomez", "transferencias"],
  [8, "gasto", 5600, "Fotocopias de la facu", null, "frasco"],
  [9, "gasto", 310, "Impuesto a los débitos", "impuestos"],
  [9, "transferencia_enviada", 120000, "Carlos Perez", "transferencias"],
  [10, "ingreso", 650000, "Sueldo", "ingresos"],
  [10, "gasto", 20000, "Extracción en cajero", "extracciones"],
  [11, "gasto", 19900, "Zapatillas", null, "pendiente"],
  [12, "gasto", 2900, "Café", "qr", "anulada"],
  [14, "gasto", 31000, "Supermercado", "debito"],
  [16, "transferencia_enviada", 9000, "Valentin Torres Gaitan", "transferencias"],
  [19, "gasto", 14500, "Nafta", "credito"],
  [23, "gasto", 27000, "Expensas", "servicios"],
  [27, "gasto", 8900, "Recital", "credito"],
  [31, "gasto", 21400, "Supermercado", "debito"],
  [34, "transferencia_enviada", 120000, "Carlos Perez", "transferencias"],
  [36, "gasto", 16700, "Cena", "qr"],
  [40, "ingreso", 610000, "Sueldo", "ingresos"],
  [44, "gasto", 12300, "Nafta", "debito"],
  [50, "gasto", 9400, "Farmacia", "debito"],
];

/**
 * Repositorio en memoria que arranca con movimientos de muestra. Se siembra en el
 * primer uso (no al crearlo) para que las fechas salgan relativas al día de hoy.
 */
export function repositorioDeMuestra(): Repositorio {
  const base = repositorioEnMemoria();
  let sembrado: Promise<void> | null = null;

  async function sembrar() {
    const hoy = hoyEn((await base.perfil()).zonaHoraria);
    await base.guardarNombre("Juan Pedro");
    const { id: frascoId } = await base.crearFrasco("Facu");
    await base.aportarAFrasco(frascoId, 2_000_000);

    for (const [diasAtras, tipo, pesos, detalle, categoriaId, extra] of SEMILLAS) {
      const esTransferencia = tipo === "transferencia_enviada" || tipo === "transferencia_recibida";
      const { id } = await base.crearTransaccion({
        tipo,
        centavos: pesos * 100,
        fecha: sumarDias(hoy, -diasAtras),
        descripcion: detalle,
        categoriaId,
        origenMensajeId: null,
        frascoId: extra === "frasco" ? frascoId : null,
        contraparte: esTransferencia || categoriaId === "debito" || categoriaId === "qr" ? detalle : null,
        interna: extra === "interna",
        metodo: categoriaId ? "imagen" : "texto",
      });
      if (extra !== "pendiente") await base.actualizarTransaccion(id, { estado: extra === "anulada" ? "anulada" : "confirmada" });
    }
  }

  // Cada método espera a que termine la siembra antes de responder.
  return new Proxy(base, {
    get(objeto, propiedad: keyof Repositorio) {
      const metodo = objeto[propiedad] as (...argumentos: unknown[]) => Promise<unknown>;
      return async (...argumentos: unknown[]) => {
        await (sembrado ??= sembrar());
        return metodo.apply(objeto, argumentos);
      };
    },
  });
}
