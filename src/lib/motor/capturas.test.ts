import { describe, expect, it } from "vitest";
import { extraerOperaciones } from "./capturas";

const HOY = "2026-10-11";
const leer = (texto: string, nombre: string | null = null) => extraerOperaciones(texto, { hoy: HOY, nombre });

const COMPROBANTE_BILLETERA = `
mercado pago
Comprobante de transferencia
Jueves, 9 de octubre de 2026 a las 14:32 hs
$ 12.500
Motivo: Varios
De
Juan Pedro Ameijeiras
CUIT/CUIL: 20-12345678-9
Mercado Pago
CVU: 0000003100012345678901
Para
MARIA LOPEZ
CUIT/CUIL: 27-87654321-0
Banco Galicia
CBU: 0070012345678901234567
Número de operación de Mercado Pago
123456789012
`;

const COMPROBANTE_BANCO = `
Transferencia realizada
$ 45.000,00
Destinatario
Carlos Perez
CBU 0170099220000067797370
Fecha 09/10/2026
Concepto: Alquiler
N° de comprobante 00012345
Saldo disponible
$ 310.220,15
`;

const LISTADO = `
9:41
Actividad
Hoy
Transferencia enviada - $ 8.000
Kiosco El Sol 14:32
Transferencia recibida + $ 12.500
Pedro Gomez 11:05
Ayer
Pago con QR -$ 3.20000
Panadería La Espiga 19:40
`;

describe("comprobantes", () => {
  it("lee importe, fecha, contraparte y número de operación", () => {
    expect(leer(COMPROBANTE_BILLETERA, "Juan Pedro")).toEqual([
      {
        tipo: "transferencia_enviada",
        centavos: 1250000,
        fecha: "2026-10-09",
        descripcion: "Maria Lopez",
        contraparte: "Maria Lopez",
        referencia: "123456789012",
        importeDudoso: false,
        rubro: "Transferencias",
        interna: false,
      },
    ]);
  });

  it("si vos sos el destinatario, es una transferencia recibida", () => {
    const [operacion] = leer(COMPROBANTE_BILLETERA, "Maria");
    expect(operacion).toMatchObject({ tipo: "transferencia_recibida", contraparte: "Juan Pedro Ameijeiras" });
  });

  it("sin saber quién sos, no adivina el sentido", () => {
    expect(leer(COMPROBANTE_BILLETERA)[0].tipo).toBeNull();
  });

  it("no confunde el saldo disponible con el importe", () => {
    expect(leer(COMPROBANTE_BANCO)).toEqual([
      {
        tipo: "transferencia_enviada",
        centavos: 4500000,
        fecha: "2026-10-09",
        descripcion: "Alquiler · Carlos Perez",
        contraparte: "Carlos Perez",
        referencia: "00012345",
        importeDudoso: false,
        rubro: "Transferencias",
        interna: false,
      },
    ]);
  });

  it("\"Mercado Pago\" no cuenta como la palabra pago", () => {
    expect(leer("Mercado Pago\nRecibiste $ 5.000\nde Lucía Fernández")[0].tipo).toBe("transferencia_recibida");
  });
});

describe("listados", () => {
  it("separa una operación por renglón, con su fecha y su sentido", () => {
    expect(leer(LISTADO)).toMatchObject([
      { tipo: "transferencia_enviada", centavos: 800000, fecha: "2026-10-11", descripcion: "Kiosco El Sol", contraparte: "Kiosco El Sol", rubro: "Transferencias" },
      { tipo: "transferencia_recibida", centavos: 1250000, fecha: "2026-10-11", descripcion: "Pedro Gomez", contraparte: "Pedro Gomez", rubro: "Transferencias" },
      { tipo: "gasto", centavos: 320000, fecha: "2026-10-10", descripcion: "Panadería La Espiga", contraparte: "Panadería La Espiga", rubro: "Pagos con QR" },
    ]);
  });

  it("una entrada de plata nunca sale como gasto", () => {
    const [operacion] = leer("Pedro Gomez + $ 9.000\nCarla Ruiz - $ 1.000");
    expect(operacion.tipo).toBe("ingreso");
  });

  it("sin signo ni palabras claras, deja el sentido sin definir", () => {
    const operaciones = leer("Pedro Gomez $ 9.000\nCarla Ruiz $ 1.000");
    expect(operaciones.map((o) => o.tipo)).toEqual([null, null]);
    expect(operaciones.map((o) => o.descripcion)).toEqual(["Pedro Gomez", "Carla Ruiz"]);
  });

  it("lee el texto que está arriba del importe cuando la lista termina en un importe", () => {
    const operaciones = leer("Pedro Gomez\n+ $ 9.000\nCarla Ruiz\n- $ 1.000");
    expect(operaciones.map((o) => o.descripcion)).toEqual(["Pedro Gomez", "Carla Ruiz"]);
  });
});

describe("importes de captura", () => {
  it.each([
    ["Pago $ 8.000 00\nOtro $ 1", 800000, false],
    ["Pago $ 3.249 90\nOtro $ 1", 324990, true],
    ["Pago $ 50000\nOtro $ 1", 5000000, true],
    ["Pago $ 1.234.567,89\nOtro $ 1", 123456789, false],
    ["Pago $ 8.000 14:32\nOtro $ 1", 800000, false],
  ])("%s", (texto, centavos, dudoso) => {
    expect(leer(texto)[0]).toMatchObject({ centavos, importeDudoso: dudoso });
  });

  it("sin el signo $ no hay operación", () => {
    expect(leer("CBU 0170099220000067797370\n14:32\n123456")).toEqual([]);
  });
});

// Texto real que devolvió el lector para una captura de billetera con siete operaciones.
const BILLETERA = `11:10

02 de octubre

— Transferencia enviada - $ 1.200,00
Valentin Torres Gaitan
02 de octubre

— Pagocon tarjeta de débito - $ 10.860,00
Cp*pack Claro
02 de octubre

— — Acreditación de frasco + $ 40.000,00
Fondo
02 de octubre

— Rendimiento diario + $ 1,69
01 de octubre

— — Transferencia enviada - $ 60.000,00
Ameijeiras Juan Pedro
01 de octubre

— Dinero agregado a Frasco - $ 40.000,00
Fondo
01 de octubre

— Dinero agregado a Frasco - $ 30.000,00
Finde 3-4
`;

describe("captura real de billetera", () => {
  const operaciones = leer(BILLETERA, "Juan Pedro");

  it("separa las siete operaciones con su importe y su fecha", () => {
    expect(operaciones.map((o) => [o.centavos, o.fecha])).toEqual([
      [120000, "2026-10-02"],
      [1086000, "2026-10-02"],
      [4000000, "2026-10-02"],
      [169, "2026-10-02"],
      [6000000, "2026-10-01"],
      [4000000, "2026-10-01"],
      [3000000, "2026-10-01"],
    ]);
    expect(operaciones.every((o) => !o.importeDudoso)).toBe(true);
  });

  it("clasifica por tipo de operación y guarda con quién fue", () => {
    expect(operaciones.map((o) => [o.rubro, o.tipo, o.descripcion])).toEqual([
      ["Transferencias", "transferencia_enviada", "Valentin Torres Gaitan"],
      ["Pagos con tarjeta de débito", "gasto", "Cp*pack Claro"],
      ["Entre mis cuentas", "transferencia_recibida", "Fondo"],
      ["Rendimientos diarios", "ingreso", "Rendimiento diario"],
      ["Entre mis cuentas", "transferencia_enviada", "Ameijeiras Juan Pedro"],
      ["Entre mis cuentas", "transferencia_enviada", "Fondo"],
      ["Entre mis cuentas", "transferencia_enviada", "Finde 3-4"],
    ]);
    expect(operaciones[0].contraparte).toBe("Valentin Torres Gaitan");
    expect(operaciones[3].contraparte).toBeNull();
  });

  it("los movimientos entre frascos y a tu propio nombre son internos", () => {
    expect(operaciones.map((o) => o.interna)).toEqual([false, false, true, false, true, true, true]);
  });

  it("con un nombre suelto no asume que una transferencia es a vos", () => {
    const conNombreCorto = leer(BILLETERA, "Juan");
    expect(conNombreCorto[4]).toMatchObject({ interna: false, rubro: "Transferencias", tipo: "transferencia_enviada" });
  });

  it("en un listado, un renglón de impuestos es una operación", () => {
    const [impuesto] = leer("05 de octubre\nImpuesto sobre los ingresos brutos - $ 310,45\n05 de octubre\nPago con QR - $ 2.000,00\nKiosco");
    expect(impuesto).toMatchObject({ rubro: "Impuestos", tipo: "gasto", centavos: 31045 });
  });
});
