import { hoyEn } from "../fia/conversacion";
import { sumarDias } from "../motor/fechas";
import type { Tipo } from "../motor/interpretar";
import { repositorioEnMemoria } from "./memoria";
import type { Repositorio } from "./repositorio";

type Extra = "interna" | "pendiente" | "anulada" | "frasco";
/** `categoria`: el id de una de base, o el nombre de una propia (se crea sola). `aclaracion`: persona, comercio o nota. */
type Semilla = [diasAtras: number, tipo: Tipo, pesos: number, categoria: string, aclaracion: string | null, extra?: Extra];

const DE_BASE = ["transferencias", "debito", "credito", "qr", "servicios", "extracciones", "impuestos", "ingresos", "rendimientos", "propias"];

// Dos meses de movimientos inventados, para ver el panel con algo adentro.
const SEMILLAS: Semilla[] = [
  [0, "gasto", 8200, "Cantina", "Almuerzo"],
  [0, "gasto", 3100, "Taxi", null],
  [1, "gasto", 12500, "debito", "Cp*pack Claro"],
  [1, "transferencia_enviada", 1200, "transferencias", "Valentin Torres Gaitan"],
  [2, "gasto", 23900, "Supermercado", null],
  [2, "ingreso", 2, "rendimientos", "Rendimiento diario"],
  [3, "gasto", 6400, "Apuntes", "Facu", "frasco"],
  [3, "transferencia_enviada", 40000, "propias", "Fondo", "interna"],
  [4, "gasto", 15800, "Cantina", "Cena con amigos"],
  [5, "transferencia_enviada", 18000, "transferencias", "Marta Suarez"],
  [5, "gasto", 4200, "qr", "Kiosco El Sol"],
  [6, "gasto", 9800, "Farmacia", null],
  [7, "gasto", 2600, "Cantina", null],
  [8, "transferencia_recibida", 25000, "transferencias", "Pedro Gomez"],
  [8, "gasto", 5600, "Apuntes", "Fotocopias", "frasco"],
  [9, "gasto", 310, "impuestos", "Impuesto a los débitos"],
  [9, "transferencia_enviada", 120000, "transferencias", "Carlos Perez"],
  [10, "ingreso", 650000, "ingresos", "Sueldo"],
  [10, "gasto", 7300, "Taxi", "Aeropuerto"],
  [11, "gasto", 19900, "Zapatillas", null, "pendiente"],
  [12, "gasto", 2900, "Cine", null, "anulada"],
  [14, "gasto", 31000, "Supermercado", null],
  [16, "transferencia_enviada", 9000, "transferencias", "Valentin Torres Gaitan"],
  [19, "gasto", 14500, "Nafta", null],
  [23, "gasto", 27000, "servicios", "Expensas"],
  [27, "gasto", 8900, "Cantina", "Almuerzo"],
  [31, "gasto", 21400, "Supermercado", null],
  [34, "transferencia_enviada", 120000, "transferencias", "Carlos Perez"],
  [36, "gasto", 16700, "Cantina", "Cena"],
  [40, "ingreso", 610000, "ingresos", "Sueldo"],
  [44, "gasto", 12300, "Nafta", null],
  [50, "gasto", 9400, "Farmacia", null],
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

    const propias = new Map<string, string>();
    for (const [diasAtras, tipo, pesos, categoria, aclaracion, extra] of SEMILLAS) {
      const esDeBase = DE_BASE.includes(categoria);
      if (!esDeBase && !propias.has(categoria)) propias.set(categoria, (await base.crearCategoria(categoria, "gasto")).id);
      const { id } = await base.crearTransaccion({
        tipo,
        centavos: pesos * 100,
        fecha: sumarDias(hoy, -diasAtras),
        descripcion: aclaracion ?? (esDeBase ? "Movimiento" : categoria),
        categoriaId: esDeBase ? categoria : propias.get(categoria)!,
        origenMensajeId: null,
        frascoId: extra === "frasco" ? frascoId : null,
        contraparte: aclaracion,
        interna: extra === "interna",
        metodo: esDeBase && categoria !== "transferencias" && categoria !== "ingresos" ? "imagen" : "texto",
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
