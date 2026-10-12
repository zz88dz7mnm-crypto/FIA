import { describe, expect, it } from "vitest";
import { clasificar } from "./categorias";
import { buscarFecha, describirFecha, rangoDe } from "./fechas";
import { buscarImportes, centavosADecimal, decimalACentavos, formatearImporte } from "./importes";
import { completar, interpretar, type Borrador, type Intencion } from "./interpretar";
import { CATEGORIAS_DE_MUESTRA } from "./muestras";
import { plano } from "./texto";

const HOY = "2026-10-11"; // domingo
const ctx = { hoy: HOY, categorias: CATEGORIAS_DE_MUESTRA, reglas: [] };

const leer = (texto: string) => buscarImportes(plano(texto)).map((i) => i.centavos);
const movimiento = (texto: string) => {
  const r = interpretar(texto, ctx);
  if (r.clase !== "movimiento") throw new Error(`"${texto}" se leyó como ${r.clase}`);
  return r;
};

describe("importes", () => {
  it.each([
    ["4500", 450000],
    ["4.500", 450000],
    ["$4.500", 450000],
    ["$ 4.500,50", 450050],
    ["4500,5", 450050],
    ["4500.50", 450050],
    ["1.234.567,89", 123456789],
    ["12k", 1200000],
    ["12 lucas", 1200000],
    ["una luca", 100000],
    ["5 mil", 500000],
    ["2 palos", 200000000],
    ["1,5 palos", 150000000],
    ["medio palo", 50000000],
  ])("lee %s", (texto, centavos) => {
    expect(leer(texto)).toEqual([centavos]);
  });

  it("marca como dudoso el formato ambiguo", () => {
    const [importe] = buscarImportes("4,500");
    expect(importe).toMatchObject({ centavos: 450000, dudoso: true });
  });

  it("no toma números pegados a letras ni fechas", () => {
    expect(leer("12kg de papa")).toEqual([]);
    expect(leer("5 milanesas")).toEqual([500]);
  });

  it("formatea y convierte sin perder centavos", () => {
    expect(formatearImporte(450000)).toBe("$4.500");
    expect(formatearImporte(123456789)).toBe("$1.234.567,89");
    expect(formatearImporte(-5)).toBe("-$0,05");
    expect(centavosADecimal(450050)).toBe("4500.50");
    expect(decimalACentavos(4500.5)).toBe(450050);
    expect(decimalACentavos("0.07")).toBe(7);
    expect(decimalACentavos(999999999999.99)).toBe(99999999999999);
  });
});

describe("fechas", () => {
  const fecha = (texto: string) => buscarFecha(plano(texto), HOY)?.fecha;

  it("entiende fechas relativas y explícitas", () => {
    expect(fecha("ayer")).toBe("2026-10-10");
    expect(fecha("antes de ayer")).toBe("2026-10-09");
    expect(fecha("el 5/10")).toBe("2026-10-05");
    expect(fecha("3 de septiembre")).toBe("2026-09-03");
    expect(fecha("05/01/2025")).toBe("2025-01-05");
    expect(fecha("el viernes")).toBe("2026-10-09");
    expect(fecha("el domingo")).toBe("2026-10-04");
  });

  it("una fecha sin año nunca queda en el futuro", () => {
    expect(fecha("25/12")).toBe("2025-12-25");
  });

  it("descarta fechas imposibles", () => {
    expect(fecha("31/02")).toBeUndefined();
  });

  it("arma los rangos de cada período", () => {
    expect(rangoDe("semana", HOY)).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" });
    expect(rangoDe("mes", HOY)).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(rangoDe("mes_pasado", "2026-01-15")).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
    expect(describirFecha("2026-10-10", HOY)).toBe("ayer");
    expect(describirFecha("2025-12-25", HOY)).toBe("25 de diciembre de 2025");
  });
});

describe("categorías", () => {
  it("clasifica por palabra entera, con plural", () => {
    expect(clasificar("Almuerzo con Juan", CATEGORIAS_DE_MUESTRA)?.id).toBe("comida");
    expect(clasificar("empanadas", CATEGORIAS_DE_MUESTRA)?.id).toBe("comida");
    expect(clasificar("barrio", CATEGORIAS_DE_MUESTRA)).toBeNull();
  });

  it("gana la frase más específica", () => {
    expect(clasificar("gas para el transporte publico", CATEGORIAS_DE_MUESTRA)?.id).toBe("transporte");
  });

  it("las reglas personales pisan a las base", () => {
    const reglas = [{ patron: "cafe", categoriaId: "entretenimiento" }];
    expect(clasificar("café con amigos", CATEGORIAS_DE_MUESTRA, reglas)?.id).toBe("entretenimiento");
  });
});

describe("interpretar: formato con punto y coma", () => {
  it("gasto; 4500; comida; almuerzo", () => {
    expect(movimiento("gasto; 4500; comida; almuerzo")).toMatchObject({
      falta: null,
      borrador: { tipo: "gasto", centavos: 450000, categoriaId: "comida", descripcion: "Almuerzo", fecha: HOY },
    });
  });

  it("ingreso; 250000; trabajo; sueldo", () => {
    expect(movimiento("ingreso; 250000; trabajo; sueldo").borrador).toMatchObject({
      tipo: "ingreso", centavos: 25000000, categoriaId: "ingresos", descripcion: "Sueldo",
    });
  });

  it("transferencia enviada; 12000; alquiler", () => {
    expect(movimiento("transferencia enviada; 12000; alquiler").borrador).toMatchObject({
      tipo: "transferencia_enviada", centavos: 1200000, categoriaId: "vivienda", descripcion: "Alquiler",
    });
  });

  it("gastos; transporte; este mes", () => {
    expect(interpretar("gastos; transporte; este mes", ctx)).toEqual({
      clase: "gastos_categoria", categoriaId: "transporte", periodo: "mes",
    });
  });

  it("avisa si la categoría consultada no existe", () => {
    expect(interpretar("gastos; mascotas; este mes", ctx)).toEqual({ clase: "categoria_desconocida", buscada: "mascotas" });
  });

  it("si falta el importe, lo pide", () => {
    expect(movimiento("gasto; ; comida; almuerzo")).toMatchObject({ falta: "importe", borrador: { centavos: null } });
  });
});

describe("interpretar: escritura libre", () => {
  it.each<[string, Partial<Borrador>]>([
    ["gasté 4500 en almuerzo", { tipo: "gasto", centavos: 450000, categoriaId: "comida", descripcion: "Almuerzo" }],
    ["Pagué 12 lucas de alquiler", { tipo: "gasto", centavos: 1200000, categoriaId: "vivienda", descripcion: "Alquiler" }],
    ["cobré 250.000 del sueldo", { tipo: "ingreso", centavos: 25000000, categoriaId: "ingresos", descripcion: "Sueldo" }],
    ["taxi 3200", { tipo: "gasto", centavos: 320000, categoriaId: "transporte", descripcion: "Taxi" }],
    ["me salió $8.500 el cine ayer", { tipo: "gasto", centavos: 850000, categoriaId: "entretenimiento", descripcion: "Cine", fecha: "2026-10-10" }],
    ["me transfirieron 30000", { tipo: "transferencia_recibida", centavos: 3000000, categoriaId: null }],
    ["transferí 12000 a Juan", { tipo: "transferencia_enviada", centavos: 1200000, descripcion: "Juan" }],
    ["cobré 50000 de Marta", { tipo: "ingreso", centavos: 5000000, categoriaId: "ingresos", descripcion: "Marta" }],
    ["compré zapatillas 89.999,90 el 5/10", { tipo: "gasto", centavos: 8999990, categoriaId: null, descripcion: "Zapatillas", fecha: "2026-10-05" }],
  ])("%s", (texto, esperado) => {
    const r = movimiento(texto);
    expect(r.falta).toBeNull();
    expect(r.borrador).toMatchObject(esperado);
  });

  it("una transferencia recibida nunca es un gasto", () => {
    expect(movimiento("me pasaron 15000 por la cena").borrador.tipo).toBe("transferencia_recibida");
  });

  it("sin tipo ni categoría reconocible, pregunta en vez de suponer", () => {
    const r = movimiento("4500 cosas");
    expect(r).toMatchObject({ falta: "tipo", opcionesTipo: ["gasto", "ingreso"], borrador: { tipo: null, centavos: 450000 } });
  });

  it("una transferencia sin sentido claro pregunta si fue enviada o recibida", () => {
    const r = movimiento("transferencia 20000 Pedro");
    expect(r).toMatchObject({ falta: "tipo", opcionesTipo: ["transferencia_enviada", "transferencia_recibida"] });
    expect(r.borrador.descripcion).toBe("Pedro");
  });

  it("sin importe, lo pide", () => {
    expect(movimiento("gasté en el súper")).toMatchObject({ falta: "importe", borrador: { tipo: "gasto", categoriaId: "comida" } });
    expect(movimiento("taxi")).toMatchObject({ falta: "importe", borrador: { tipo: "gasto", categoriaId: "transporte" } });
  });

  it("con dos números, ofrece ambos como importe", () => {
    const r = movimiento("2 cafés 4500");
    expect(r.falta).toBe("importe");
    expect(r.opcionesImporte).toEqual([
      { centavos: 200, descripcion: "Cafés 4500" },
      { centavos: 450000, descripcion: "2 cafés" },
    ]);
  });

  it("marca el importe dudoso para revisarlo", () => {
    expect(movimiento("gasté 4,500 en nafta").borrador).toMatchObject({ centavos: 450000, importeDudoso: true });
  });
});

describe("interpretar: consultas y comandos", () => {
  it.each<[string, Intencion]>([
    ["resumen del mes", { clase: "resumen", periodo: "mes" }],
    ["Resumen de la semana", { clase: "resumen", periodo: "semana" }],
    ["¿cómo vengo?", { clase: "resumen", periodo: "mes" }],
    ["resumen del mes pasado", { clase: "resumen", periodo: "mes_pasado" }],
    ["cuánto gasté en comida esta semana", { clase: "gastos_categoria", categoriaId: "comida", periodo: "semana" }],
    ["cuánto gasté hoy", { clase: "resumen", periodo: "hoy" }],
    ["últimos movimientos", { clase: "ultimos" }],
    ["borrá el último", { clase: "deshacer" }],
    ["ayuda", { clase: "ayuda" }],
    ["Hola Fia!", { clase: "saludo" }],
    ["gracias", { clase: "gracias" }],
    ["qué lindo día", { clase: "desconocido" }],
  ])("%s", (texto, esperado) => {
    expect(interpretar(texto, ctx)).toEqual(esperado);
  });
});

describe("completar una pregunta", () => {
  const base = { tipo: null, centavos: null, categoriaId: null, descripcion: "Cosas", fecha: HOY, importeDudoso: false };

  it("toma el importe si la respuesta es solo eso", () => {
    expect(completar(base, "importe", "fueron 4.500")?.centavos).toBe(450000);
    expect(completar(base, "importe", "$4500")?.centavos).toBe(450000);
    expect(completar(base, "importe", "gasté 300 en taxi")).toBeNull();
  });

  it("toma el tipo si la respuesta es solo eso", () => {
    expect(completar(base, "tipo", "Gasto")?.tipo).toBe("gasto");
    expect(completar(base, "tipo", "fue un ingreso")?.tipo).toBe("ingreso");
    expect(completar(base, "tipo", "la recibí")?.tipo).toBe("transferencia_recibida");
    expect(completar(base, "tipo", "taxi 3200")).toBeNull();
  });
});
