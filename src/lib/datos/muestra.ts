import { hoyEn } from "../fia/conversacion";
import { sumarDias } from "../motor/fechas";
import type { Tipo } from "../motor/interpretar";
import { repositorioEnMemoria } from "./memoria";
import type { Repositorio } from "./repositorio";

type Semilla = [diasAtras: number, tipo: Tipo, pesos: number, detalle: string, categoria: string | null, extra?: "interna" | "pendiente" | "anulada" | "frasco"];

// Dos meses de movimientos inventados, para ver el panel con algo adentro.
const SEMILLAS: Semilla[] = [
  [0, "gasto", 8200, "Almuerzo", "comida"],
  [0, "gasto", 3100, "Subte y colectivo", "transporte"],
  [1, "gasto", 12500, "Cp*pack Claro", "tarjeta"],
  [1, "transferencia_enviada", 1200, "Valentin Torres Gaitan", "transferencias"],
  [2, "gasto", 23900, "Supermercado", "comida"],
  [2, "ingreso", 2, "Rendimiento diario", "rendimientos"],
  [3, "gasto", 6400, "Apuntes de la facu", null, "frasco"],
  [3, "transferencia_enviada", 40000, "Fondo", "propias", "interna"],
  [4, "gasto", 15800, "Cena con amigos", "comida"],
  [5, "transferencia_enviada", 18000, "Marta Suarez", "transferencias"],
  [5, "gasto", 4200, "Kiosco El Sol", "qr"],
  [6, "gasto", 9800, "Farmacia", "salud"],
  [7, "gasto", 11200, "Cine", "entretenimiento"],
  [8, "transferencia_recibida", 25000, "Pedro Gomez", "transferencias"],
  [8, "gasto", 5600, "Fotocopias de la facu", null, "frasco"],
  [9, "gasto", 310, "Impuesto a los débitos", "impuestos"],
  [9, "transferencia_enviada", 120000, "Alquiler · Carlos Perez", "vivienda"],
  [10, "ingreso", 650000, "Sueldo", "ingresos"],
  [10, "gasto", 7300, "Taxi", "transporte"],
  [11, "gasto", 19900, "Zapatillas", null, "pendiente"],
  [12, "gasto", 2900, "Café", "comida", "anulada"],
  [14, "gasto", 31000, "Supermercado", "comida"],
  [16, "transferencia_enviada", 9000, "Valentin Torres Gaitan", "transferencias"],
  [19, "gasto", 14500, "Nafta", "transporte"],
  [23, "gasto", 27000, "Expensas", "vivienda"],
  [27, "gasto", 8900, "Recital", "entretenimiento"],
  [31, "gasto", 21400, "Supermercado", "comida"],
  [34, "transferencia_enviada", 120000, "Alquiler · Carlos Perez", "vivienda"],
  [36, "gasto", 16700, "Cena", "comida"],
  [40, "ingreso", 610000, "Sueldo", "ingresos"],
  [44, "gasto", 12300, "Nafta", "transporte"],
  [50, "gasto", 9400, "Farmacia", "salud"],
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
        contraparte: esTransferencia || categoriaId === "tarjeta" || categoriaId === "qr" ? detalle : null,
        interna: extra === "interna",
        metodo: categoriaId && ["tarjeta", "transferencias", "rendimientos", "propias", "qr", "impuestos"].includes(categoriaId) ? "imagen" : "texto",
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
