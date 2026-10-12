import { describe, expect, it } from "vitest";
import { rangoPrevio } from "./motor/fechas";
import { CATEGORIAS_DE_MUESTRA } from "./motor/muestras";
import { detalleDeCategoria, gastoPorCategoria, porciones, serie, topeRedondo, totales, variacion, type GrupoDeGasto } from "./panel";
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
  mov("gasto", 450000, "2026-10-03", "debito"),
  mov("gasto", 1200000, "2026-10-03", "debito"),
  mov("transferencia_enviada", 12000000, "2026-10-05", "transferencias"),
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
      ["Transferencias", 12000000],
      ["Pagos con tarjeta de débito", 1650000],
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

  describe("gráfico circular", () => {
    const grupo = (id: string | null, nombre: string, centavos: number): GrupoDeGasto => ({ id, nombre, centavos, parte: centavos / 1000 });

    it("un mismo nombre lleva siempre el mismo color, sea cual sea su importe", () => {
      const junio = porciones([grupo("c", "Cantina", 700), grupo("t", "Transferencias", 300)]);
      const julio = porciones([grupo("t", "Transferencias", 900), grupo("c", "Cantina", 50), grupo("k", "Kiosco", 50)]);
      const color = (lista: typeof junio, nombre: string) => lista.find((p) => p.nombre === nombre)?.color;
      expect(color(junio, "Transferencias")).toBe("#2a78d6");
      expect(color(julio, "Transferencias")).toBe("#2a78d6");
      expect(color(junio, "Cantina")).toBe(color(julio, "Cantina"));
    });

    it("dos porciones nunca comparten color, y lo que no tiene nombre va en gris", () => {
      const circulo = porciones([
        grupo("a", "Cantina", 300),
        grupo("b", "Kiosco", 250),
        grupo("c", "Taxi", 200),
        grupo("d", "Apuntes", 150),
        grupo(null, "Sin clasificar", 100),
      ]);
      const colores = circulo.map((p) => p.color);
      expect(new Set(colores).size).toBe(colores.length);
      expect(circulo.find((p) => p.nombre === "Sin clasificar")?.color).toBe("#8e8e93");
    });

    it("nunca muestra más de seis porciones: las más chicas van a Otras", () => {
      const circulo = porciones([
        grupo("t", "Transferencias", 300),
        grupo("a", "Cantina", 250),
        grupo("b", "Kiosco", 150),
        grupo("c", "Taxi", 120),
        grupo("d", "Apuntes", 90),
        grupo("e", "Cine", 50),
        grupo("f", "Farmacia", 40),
      ]);
      expect(circulo).toHaveLength(6);
      expect(circulo.at(-1)).toMatchObject({ nombre: "Otras", centavos: 90, color: "#c7c7cc" });
      expect(circulo.reduce((suma, p) => suma + p.centavos, 0)).toBe(1000);
    });
  });

  it("desglosa una categoría por su aclaración", () => {
    const movimientos = [
      mov("transferencia_enviada", 120000, "2026-10-02", "transferencias", "Valentin Torres"),
      mov("transferencia_enviada", 500000, "2026-10-05", "transferencias", "valentin torres"),
      mov("transferencia_enviada", 380000, "2026-10-06", "transferencias", "Marta"),
      mov("transferencia_recibida", 999999, "2026-10-06", "transferencias", "Pedro"),
      mov("gasto", 200000, "2026-10-07", "cantina"),
      mov("gasto", 300000, "2026-10-07", "cantina", "Almuerzo"),
    ];
    expect(detalleDeCategoria(movimientos, "transferencias")).toEqual([
      { id: "valentin torres", nombre: "Valentin Torres", centavos: 620000, parte: 0.62 },
      { id: "marta", nombre: "Marta", centavos: 380000, parte: 0.38 },
    ]);
    expect(detalleDeCategoria(movimientos, "cantina").map((g) => [g.nombre, g.centavos])).toEqual([
      ["Almuerzo", 300000],
      ["Sin aclaración", 200000],
    ]);
  });

  it("redondea el tope del eje", () => {
    expect([0, 7, 1650000, 12000000, 20000000].map(topeRedondo)).toEqual([0, 10, 2000000, 20000000, 20000000]);
  });
});
