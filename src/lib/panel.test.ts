import { describe, expect, it } from "vitest";
import { rangoPrevio } from "./motor/fechas";
import { CATEGORIAS_DE_MUESTRA } from "./motor/muestras";
import { gastoPorCategoria, serie, topeRedondo, totales, transferenciasPorPersona, variacion } from "./panel";
import type { Transaccion } from "./tipos";

const mov = (tipo: Transaccion["tipo"], centavos: number, fecha: string, categoriaId: string | null = null, contraparte: string | null = null): Transaccion => ({
  id: `${tipo}-${fecha}-${centavos}`,
  tipo,
  centavos,
  fecha,
  descripcion: "",
  categoriaId,
  frascoId: null,
  contraparte,
  interna: false,
  referencia: null,
  metodo: "texto",
  estado: "confirmada",
  creadoEn: "",
});

const MOVIMIENTOS = [
  mov("gasto", 450000, "2026-10-03", "comida"),
  mov("gasto", 1200000, "2026-10-03", "comida"),
  mov("transferencia_enviada", 12000000, "2026-10-05", "vivienda"),
  mov("gasto", 320000, "2026-10-09"),
  mov("ingreso", 25000000, "2026-10-01", "ingresos"),
  mov("transferencia_recibida", 3000000, "2026-10-09"),
];

describe("panel", () => {
  it("suma lo que entró, lo que salió y lo que queda", () => {
    expect(totales(MOVIMIENTOS)).toEqual({ entro: 28000000, salio: 13970000, queda: 14030000 });
  });

  it("agrupa los gastos por categoría, de mayor a menor, con su parte del total", () => {
    const grupos = gastoPorCategoria(MOVIMIENTOS, CATEGORIAS_DE_MUESTRA);
    expect(grupos.map((g) => [g.nombre, g.centavos])).toEqual([
      ["Vivienda", 12000000],
      ["Comida", 1650000],
      ["Sin clasificar", 320000],
    ]);
    expect(grupos.reduce((suma, g) => suma + g.parte, 0)).toBeCloseTo(1);
  });

  it("arma un punto por día, también para los días sin movimientos", () => {
    const puntos = serie(MOVIMIENTOS, "2026-10-01", "2026-10-31");
    expect(puntos).toHaveLength(31);
    expect(puntos[2]).toEqual({ clave: "2026-10-03", etiqueta: "3", salio: 1650000, entro: 0 });
    expect(puntos[8]).toMatchObject({ salio: 320000, entro: 3000000 });
    expect(puntos[30]).toMatchObject({ etiqueta: "31", salio: 0 });
  });

  it("para el año arma un punto por mes", () => {
    const puntos = serie(MOVIMIENTOS, "2026-01-01", "2026-12-31", true);
    expect(puntos.map((p) => p.etiqueta)).toEqual(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]);
    expect(puntos[9]).toMatchObject({ clave: "2026-10", salio: 13970000, entro: 28000000 });
  });

  it("compara contra el período anterior", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(80, 100)).toBe(-20);
    expect(variacion(100, 0)).toBeNull();
    expect(rangoPrevio("mes", "2026-10-11")).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(rangoPrevio("mes_pasado", "2026-10-11")).toEqual({ desde: "2026-08-01", hasta: "2026-08-31" });
    expect(rangoPrevio("semana", "2026-10-11")).toEqual({ desde: "2026-09-28", hasta: "2026-10-04" });
    expect(rangoPrevio("anio", "2026-10-11")).toEqual({ desde: "2025-01-01", hasta: "2025-12-31" });
  });

  it("agrupa las transferencias por persona", () => {
    const personas = transferenciasPorPersona([
      mov("transferencia_enviada", 120000, "2026-10-02", null, "Valentin Torres"),
      mov("transferencia_enviada", 500000, "2026-10-05", null, "valentin torres"),
      mov("transferencia_recibida", 1250000, "2026-10-06", null, "Pedro Gomez"),
      mov("transferencia_recibida", 30000, "2026-10-07", null, "Valentin Torres"),
      mov("gasto", 999999, "2026-10-07"),
    ]);
    expect(personas).toEqual([
      { nombre: "Pedro Gomez", enviado: 0, recibido: 1250000, cantidad: 1 },
      { nombre: "Valentin Torres", enviado: 620000, recibido: 30000, cantidad: 3 },
    ]);
  });

  it("redondea el tope del eje", () => {
    expect([0, 7, 1650000, 12000000, 20000000].map(topeRedondo)).toEqual([0, 10, 2000000, 20000000, 20000000]);
  });
});
