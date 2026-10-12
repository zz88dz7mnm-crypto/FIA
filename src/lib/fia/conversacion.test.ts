import { beforeEach, describe, expect, it } from "vitest";
import { repositorioEnMemoria } from "../datos/memoria";
import type { Repositorio } from "../datos/repositorio";
import type { Mensaje, Transaccion } from "../tipos";
import { abrir, anular, confirmar, confirmarVarios, descartar, editar, recibir, recibirCaptura, type Sesion } from "./conversacion";

const HOY = "2026-10-11";

let repo: Repositorio;
let sesion: Sesion;
let ultimo: Mensaje | null;

/** Manda un mensaje y devuelve lo que contestó Fia. */
async function decir(texto: string) {
  const novedad = await recibir(sesion, texto, ultimo);
  ultimo = novedad.mensajes.at(-1) ?? ultimo;
  return { fia: novedad.mensajes.at(-1)!, transaccion: novedad.transacciones[0] as Transaccion | undefined };
}

/** Manda un movimiento completo y lo confirma. */
async function anotar(texto: string) {
  const { transaccion } = await decir(texto);
  return confirmar(sesion, transaccion!.id);
}

beforeEach(async () => {
  repo = repositorioEnMemoria();
  const abierta = await abrir(repo);
  sesion = { ...abierta.sesion, hoy: () => HOY };
  ultimo = abierta.mensajes.at(-1) ?? null;
});

describe("presentación", () => {
  it("la primera vez Fia se presenta y pregunta el nombre", async () => {
    expect(ultimo?.datos.clase).toBe("pide_nombre");
    const { fia } = await decir("me llamo Juan Pedro");
    expect(fia.texto).toContain("Un gusto, Juan Pedro");
    expect((await repo.perfil()).nombre).toBe("Juan Pedro");
  });

  it("si en vez del nombre llega un gasto, lo toma como gasto", async () => {
    const { fia, transaccion } = await decir("taxi 3200");
    expect(fia.datos.clase).toBe("propuesta");
    expect(transaccion?.centavos).toBe(320000);
    expect((await repo.perfil()).nombre).toBeNull();
  });

  it("al volver, no se presenta de nuevo", async () => {
    const otraVez = await abrir(repo);
    expect(otraVez.mensajes).toHaveLength(1);
  });
});

describe("anotar un movimiento", () => {
  it("lo propone en revisión y recién cuenta al confirmarlo", async () => {
    const { fia, transaccion } = await decir("gasté 4500 en almuerzo");
    expect(fia.texto).toBe("¿Lo anoto así?");
    expect(transaccion).toMatchObject({ estado: "en_revision", tipo: "gasto", centavos: 450000, descripcion: "Almuerzo" });
    expect(await repo.confirmadasEntre("2026-10-01", "2026-10-31")).toHaveLength(0);

    const confirmado = await confirmar(sesion, transaccion!.id);
    expect(confirmado.transacciones[0].estado).toBe("confirmada");
    expect(confirmado.mensajes[0].texto).toBe("Anotado. Llevás $4.500 en Almuerzo este mes.");
  });

  it("acumula el total de la categoría en el mes", async () => {
    await anotar("cantina 4500");
    const segundo = await anotar("cantina 12.000 almuerzo");
    expect(segundo.mensajes[0].texto).toBe("Anotado. Llevás $16.500 en Cantina este mes.");
  });

  it("descartar no deja nada en los totales", async () => {
    const { transaccion } = await decir("gasté 4500 en almuerzo");
    const descartado = await descartar(sesion, transaccion!.id);
    expect(descartado.transacciones[0].estado).toBe("rechazada");
    expect(await repo.ultimas(5)).toHaveLength(0);
  });

  it("editar guarda los cambios y confirma", async () => {
    const { transaccion } = await decir("gasté 4500 en almuerzo");
    const editado = await editar(sesion, transaccion!.id, { centavos: 520000, categoriaId: "qr" });
    expect(editado.transacciones[0]).toMatchObject({ estado: "confirmada", centavos: 520000, categoriaId: "qr" });
    expect(editado.mensajes[0].texto).toBe(
      "Anotado. Llevás $5.200 en Pagos con QR este mes. La próxima vez que aparezca «Almuerzo» lo pongo en Pagos con QR.",
    );
  });

  it("anular lo saca de los totales sin borrarlo", async () => {
    const { transacciones } = await anotar("gasté 4500 en almuerzo");
    const anulado = await anular(sesion, transacciones[0].id);
    expect(anulado.transacciones[0].estado).toBe("anulada");
    expect(await repo.confirmadasEntre("2026-10-01", "2026-10-31")).toHaveLength(0);
    expect(await repo.transaccionesPorId([transacciones[0].id])).toHaveLength(1);
  });

  it("avisa cuando parece repetido", async () => {
    await anotar("gasté 4500 en almuerzo");
    const { fia } = await decir("gasté 4500 en almuerzo");
    expect(fia.datos).toMatchObject({ clase: "propuesta", aviso: "duplicado" });
    expect(fia.texto).toContain("Ya tengo uno igual");
  });

  it("dos gastos distintos con el mismo importe no son repetidos", async () => {
    await anotar("gasté 4500 en almuerzo");
    const { fia } = await decir("taxi 4500");
    expect(fia.datos).toEqual({ clase: "propuesta", transaccionId: expect.any(String) });
  });

  it("un ingreso cuenta cuánto entró en el mes", async () => {
    const anotado = await anotar("cobré 250 lucas de sueldo");
    expect(anotado.mensajes[0].texto).toBe("Anotado. Este mes entraron $250.000.");
  });

  it("con fecha de otro mes, lo dice", async () => {
    const anotado = await anotar("gasté 4500 en almuerzo el 3 de septiembre");
    expect(anotado.mensajes[0].texto).toBe("Anotado con fecha 3 de septiembre.");
  });
});

describe("preguntas", () => {
  it("pide el importe y completa con la respuesta", async () => {
    expect((await decir("gasté en taxi")).fia.texto).toBe("¿Cuánto fue?");
    const { fia, transaccion } = await decir("3200");
    expect(fia.datos.clase).toBe("propuesta");
    expect(transaccion).toMatchObject({ tipo: "gasto", centavos: 320000, descripcion: "Taxi" });
  });

  it("sin verbo lo propone como gasto, sin preguntar", async () => {
    const { fia, transaccion } = await decir("4500 cosas");
    expect(fia.datos.clase).toBe("propuesta");
    expect(transaccion).toMatchObject({ tipo: "gasto", centavos: 450000, descripcion: "Cosas" });
  });

  it("con solo decir transferencia la propone como enviada, sin preguntar", async () => {
    const { fia, transaccion } = await decir("transferencia 20000 Pedro");
    expect(fia.datos.clase).toBe("propuesta");
    expect(transaccion).toMatchObject({ tipo: "transferencia_enviada", centavos: 2000000, categoriaId: "transferencias", contraparte: "Pedro" });
  });

  it("con dos números, usa el elegido y su descripción", async () => {
    const { fia } = await decir("2 cafés 4500");
    expect(fia.texto).toBe("Veo más de un número. ¿Cuál es el importe?");
    const { transaccion } = await decir("$4.500");
    expect(transaccion).toMatchObject({ centavos: 450000, descripcion: "2 cafés", tipo: "gasto" });
  });

  it("primero el importe y después el tipo, si faltan los dos", async () => {
    expect((await decir("gasté")).fia.texto).toBe("¿Cuánto fue?");
    const { transaccion } = await decir("900");
    expect(transaccion).toMatchObject({ tipo: "gasto", centavos: 90000 });
  });

  it("si la respuesta es otro mensaje, lo trata como nuevo", async () => {
    await decir("gasté en taxi");
    const { transaccion } = await decir("gasté 900 en café");
    expect(transaccion).toMatchObject({ centavos: 90000, descripcion: "Café" });
  });
});

describe("consultas", () => {
  beforeEach(async () => {
    await anotar("pagué 4500 con débito en almuerzo");
    await anotar("taxi 3200 con qr");
    await anotar("transferí 120.000 a Carlos por el alquiler");
    await anotar("cobré 250 lucas de sueldo");
    await anotar("me transfirieron 30000");
    await decir("gasté 99999 en cine"); // queda en revisión: no cuenta
  });

  it("el resumen suma solo lo confirmado", async () => {
    const { fia } = await decir("resumen del mes");
    expect(fia.datos).toMatchObject({
      clase: "resumen",
      resumen: {
        entradas: 28000000,
        salidas: 12770000,
        porCategoria: [
          { nombre: "Transferencias", centavos: 12000000 },
          { nombre: "Almuerzo", centavos: 450000 },
          { nombre: "Taxi", centavos: 320000 },
        ],
      },
    });
  });

  it("gastos por categoría", async () => {
    expect((await decir("gastos; transferencias; este mes")).fia.texto).toBe("En Transferencias gastaste $120.000 en octubre, en 1 movimiento.");
    expect((await decir("cuánto gasté en impuestos hoy")).fia.texto).toBe("No anoté gastos de Impuestos hoy.");
  });

  it("últimos movimientos y deshacer", async () => {
    const ultimos = await decir("últimos");
    expect(ultimos.fia.datos).toMatchObject({ clase: "lista" });
    const deshacer = await decir("borrá el último");
    expect(deshacer.fia.datos.clase).toBe("propuesta");
    expect(deshacer.transaccion?.estado).toBe("confirmada");
  });

  it("un período sin movimientos lo dice claro", async () => {
    expect((await decir("resumen del mes pasado")).fia.texto).toBe("No anoté nada en septiembre.");
  });
});

describe("frascos", () => {
  it("arma un frasco, descuenta los gastos que lo nombran y avisa cuánto queda", async () => {
    const creado = await decir("yo designo 20000 pesos a gastos de la facu");
    expect(creado.fia.texto).toContain("Armé el frasco Facu con $20.000");
    expect(creado.fia.datos).toMatchObject({ clase: "frascos", frascos: [{ nombre: "Facu", asignado: 2000000, gastado: 0 }] });

    const { transaccion } = await decir("gasté 3000 en apuntes de la facu");
    expect(transaccion?.frascoId).toBe(sesion.frascos[0].id);
    // En revisión todavía no descuenta.
    expect((await repo.frascos())[0].gastado).toBe(0);

    const anotado = await confirmar(sesion, transaccion!.id);
    expect(anotado.mensajes[0].texto).toBe("Anotado. En el frasco Facu te quedan $17.000.");
  });

  it("avisa cuando te pasás del frasco, y anular devuelve la plata", async () => {
    await decir("frasco facu 2000");
    const { transacciones } = await anotar("gasté 3000 en apuntes de la facu");
    expect((await repo.mensajes(1))[0].texto).toBe("Anotado. Te pasaste $1.000 del frasco Facu.");

    await anular(sesion, transacciones[0].id);
    expect(sesion.frascos[0]).toMatchObject({ asignado: 200000, gastado: 0 });
  });

  it("suma, saca y muestra el estado", async () => {
    await decir("frasco facu 20000");
    expect((await decir("sumale 5000 al frasco facu")).fia.texto).toBe("Sumé $5.000 al frasco Facu.");
    expect((await decir("sacá 10000 del frasco facu")).fia.texto).toBe("Saqué $10.000 del frasco Facu.");
    const estado = await decir("mis frascos");
    expect(estado.fia.datos).toMatchObject({ clase: "frascos", frascos: [{ nombre: "Facu", asignado: 1500000 }] });
  });

  it("no saca plata de un frasco que no existe", async () => {
    expect((await decir("sacá 500 del frasco viaje")).fia.texto).toBe("No tengo un frasco que se llame «Viaje».");
    expect(await repo.frascos()).toHaveLength(0);
  });

  it("borrar el frasco deja los gastos anotados", async () => {
    await decir("frasco facu 20000");
    const { transacciones } = await anotar("gasté 3000 en apuntes de la facu");
    expect((await decir("borrá el frasco facu")).fia.texto).toContain("Borré el frasco Facu");
    expect(await repo.transaccionesPorId([transacciones[0].id])).toMatchObject([{ estado: "confirmada", frascoId: null }]);
  });

  it("al editar se puede cambiar el frasco", async () => {
    await decir("frasco facu 20000");
    const { transaccion } = await decir("gasté 4500 en almuerzo");
    const editado = await editar(sesion, transaccion!.id, { frascoId: sesion.frascos[0].id });
    expect(editado.mensajes[0].texto).toBe("Anotado. En el frasco Facu te quedan $15.500.");
  });
});

describe("capturas", () => {
  const LISTADO = [
    "Actividad",
    "Hoy",
    "Transferencia enviada - $ 8.000",
    "Kiosco El Sol 14:32",
    "Transferencia recibida + $ 12.500",
    "Pedro Gomez 11:05",
    "Pago con QR - $ 3.200",
    "Cine Gaumont 19:40",
  ].join("\n");

  it("una captura con tres operaciones produce tres movimientos separados", async () => {
    const novedad = await recibirCaptura(sesion, LISTADO);
    expect(novedad.propio.datos.clase).toBe("captura");
    expect(novedad.mensajes[0].texto).toBe("Encontré 3 movimientos en la captura. Revisalos uno por uno.");
    expect(novedad.transacciones.map((t) => [t.tipo, t.centavos, t.estado])).toEqual([
      ["transferencia_enviada", 800000, "en_revision"],
      ["transferencia_recibida", 1250000, "en_revision"],
      ["gasto", 320000, "en_revision"],
    ]);
    // La categoría es el tipo de operación que dice la captura.
    expect(novedad.transacciones.map((t) => [t.categoriaId, t.contraparte])).toEqual([
      ["transferencias", "Kiosco El Sol"],
      ["transferencias", "Pedro Gomez"],
      ["qr", "Cine Gaumont"],
    ]);
    // Nada cuenta hasta confirmar.
    expect(await repo.confirmadasEntre("2026-10-01", "2026-10-31")).toHaveLength(0);
  });

  it("se pueden confirmar todos juntos o descartar de a uno", async () => {
    const { transacciones } = await recibirCaptura(sesion, LISTADO);
    await descartar(sesion, transacciones[1].id);
    const anotados = await confirmarVarios(sesion, [transacciones[0].id, transacciones[2].id]);
    expect(anotados.mensajes[0].texto).toBe("Anotados 2 movimientos.");
    expect(await repo.confirmadasEntre("2026-10-01", "2026-10-31")).toHaveLength(2);
  });

  it("marca lo que hay que revisar: sentido, fecha y repetidos", async () => {
    const comprobante = "Comprobante de transferencia\n$ 12.500\nDe\nAna Diaz\nPara\nMaria Lopez\nNúmero de operación 123456789012";
    const primera = await recibirCaptura(sesion, comprobante);
    const id = primera.transacciones[0].id;
    expect(primera.mensajes[0].datos).toMatchObject({ clase: "lote", avisos: { [id]: ["sentido", "sin_fecha"] } });

    await editar(sesion, id, { tipo: "transferencia_recibida" });
    const otraVez = await recibirCaptura(sesion, comprobante.replace("De\nAna Diaz", "Recibiste\nDe\nAna Diaz"));
    const repetida = otraVez.transacciones[0];
    expect(otraVez.mensajes[0].datos).toMatchObject({ avisos: { [repetida.id]: ["sin_fecha", "duplicado"] } });
  });

  it("los movimientos entre tus frascos se anotan pero no cuentan en los totales", async () => {
    await decir("Juan Pedro");
    const billetera = [
      "02 de octubre", "— Transferencia enviada - $ 1.200,00", "Valentin Torres Gaitan",
      "02 de octubre", "— Rendimiento diario + $ 1,69",
      "01 de octubre", "— — Transferencia enviada - $ 60.000,00", "Ameijeiras Juan Pedro",
      "01 de octubre", "— Dinero agregado a Frasco - $ 40.000,00", "Fondo",
    ].join("\n");
    const { transacciones, mensajes } = await recibirCaptura(sesion, billetera);
    expect(transacciones.map((t) => [t.categoriaId, t.interna])).toEqual([
      ["transferencias", false],
      ["rendimientos", false],
      ["propias", true],
      ["propias", true],
    ]);
    expect(mensajes[0].datos).toMatchObject({ avisos: { [transacciones[2].id]: ["propia"], [transacciones[3].id]: ["propia"] } });

    await confirmarVarios(sesion, transacciones.map((t) => t.id));
    const { fia } = await decir("resumen del mes");
    expect(fia.datos).toMatchObject({ clase: "resumen", resumen: { entradas: 169, salidas: 120000 } });
  });

  it("una transferencia cargada por texto va a Transferencias, con la persona", async () => {
    const { transaccion } = await decir("transferí 12000 a Marta");
    expect(transaccion).toMatchObject({ categoriaId: "transferencias", contraparte: "Marta" });
  });

  it("si la imagen no trae importes, lo dice y no crea nada", async () => {
    const novedad = await recibirCaptura(sesion, "Foto de un gato\n14:32");
    expect(novedad.mensajes[0].texto).toContain("No encontré ningún movimiento");
    expect(novedad.transacciones).toHaveLength(0);
  });
});

describe("/borrar-todo", () => {
  beforeEach(async () => {
    await anotar("gasté 4500 en almuerzo");
    await anotar("taxi 3200");
    await anotar("gasté 9000 en cine el 3 de septiembre");
    await decir("frasco facu 20000");
  });

  it("pide confirmación y no borra nada hasta que digas que sí", async () => {
    const { fia } = await decir("/borrar-todo");
    expect(fia.texto).toContain("Vas a borrar todo octubre: 2 movimientos");
    expect(fia.datos).toEqual({ clase: "confirmar_borrado", desde: "2026-10-01", hasta: "2026-10-31" });
    expect(await repo.movimientosEntre("2026-10-01", "2026-10-31")).toHaveLength(2);
  });

  it("con un no, deja todo como estaba", async () => {
    await decir("/borrar-todo");
    expect((await decir("No, dejar todo")).fia.texto).toBe("Listo, no borré nada.");
    expect(await repo.movimientosEntre("2026-10-01", "2026-10-31")).toHaveLength(2);
  });

  it("con un sí, borra solo ese mes y avisa que hay que recargar", async () => {
    await decir("/borrar-todo");
    const novedad = await recibir(sesion, "Sí, borrar octubre", ultimo);
    expect(novedad.recargar).toBe(true);
    expect(novedad.mensajes[0].texto).toBe("Borré todo octubre: 2 movimientos. Arrancamos de cero.");
    expect(await repo.movimientosEntre("2026-10-01", "2026-10-31")).toHaveLength(0);
    expect(await repo.movimientosEntre("2026-09-01", "2026-09-30")).toHaveLength(1);
    expect(sesion.frascos).toHaveLength(0);
  });

  it("una frase parecida no dispara el borrado", async () => {
    expect((await decir("borrar todo")).fia.datos.clase).not.toBe("confirmar_borrado");
    expect((await decir("quiero /borrar-todo ya")).fia.datos.clase).not.toBe("confirmar_borrado");
  });

  it("si después de la pregunta llega otra cosa, sigue de largo sin borrar", async () => {
    await decir("/borrar-todo");
    const { transaccion } = await decir("gasté 900 en café");
    expect(transaccion).toMatchObject({ centavos: 90000 });
    expect(await repo.movimientosEntre("2026-10-01", "2026-10-31")).toHaveLength(3);
  });
});

describe("clasificación manual", () => {
  it("al cambiar la categoría, la recuerda para la próxima vez", async () => {
    const { transaccion } = await decir("gasté 4500 en almuerzo");
    await editar(sesion, transaccion!.id, { categoriaId: "qr" });
    expect((await repo.reglas())).toEqual([{ patron: "almuerzo", categoriaId: "qr" }]);
    expect((await decir("almuerzo con Marta 5000")).transaccion?.categoriaId).toBe("qr");
  });

  it("se puede crear una categoría propia, y gana sobre lo que dice la captura", async () => {
    const captura = "02 de octubre\n— Pagocon tarjeta de débito - $ 10.860,00\nCp*pack Claro";
    const primera = await recibirCaptura(sesion, captura);
    expect(primera.transacciones[0]).toMatchObject({ categoriaId: "debito", descripcion: "Cp*pack Claro" });

    const editado = await editar(sesion, primera.transacciones[0].id, { categoriaNueva: "celular" });
    const propia = sesion.categorias.find((c) => c.nombre === "Celular");
    expect(propia).toBeDefined();
    expect(editado.transacciones[0].categoriaId).toBe(propia!.id);
    expect(editado.mensajes[0].texto).toContain("La próxima vez que aparezca «Cp*pack Claro» lo pongo en Celular.");

    const segunda = await recibirCaptura(sesion, captura.replace("10.860,00", "11.000,00"));
    expect(segunda.transacciones[0].categoriaId).toBe(propia!.id);
  });

  it("si ya existe una categoría con ese nombre, la reutiliza", async () => {
    const { transaccion } = await decir("gasté 4500 en almuerzo");
    await editar(sesion, transaccion!.id, { categoriaNueva: "impuestos" });
    expect(sesion.categorias.filter((c) => c.nombre === "Impuestos")).toHaveLength(1);
    expect((await repo.transaccionesPorId([transaccion!.id]))[0].categoriaId).toBe("impuestos");
  });

  it("sacarle la categoría hace que olvide la regla", async () => {
    const { transaccion } = await decir("gasté 4500 en almuerzo");
    await editar(sesion, transaccion!.id, { categoriaId: "qr" });
    await editar(sesion, transaccion!.id, { categoriaId: null }, true);
    expect(await repo.reglas()).toEqual([]);
  });

  it("editar otra cosa no crea reglas", async () => {
    const { transaccion } = await decir("pagué 4500 con débito en el súper");
    await editar(sesion, transaccion!.id, { centavos: 500000, categoriaId: transaccion!.categoriaId });
    expect(await repo.reglas()).toEqual([]);
  });
});

describe("la categoría es el detalle", () => {
  const nombreDe = (id: string | null | undefined) => sesion.categorias.find((c) => c.id === id)?.nombre;

  it("crea sola la categoría con el nombre del detalle y la reutiliza", async () => {
    const primera = await decir("cantina 2000");
    expect(nombreDe(primera.transaccion?.categoriaId)).toBe("Cantina");
    expect(primera.transaccion).toMatchObject({ descripcion: "Cantina", contraparte: null });

    const segunda = await decir("cantina 3000 almuerzo");
    expect(segunda.transaccion).toMatchObject({ categoriaId: primera.transaccion!.categoriaId, descripcion: "Almuerzo", contraparte: "Almuerzo" });
    expect(sesion.categorias.filter((c) => c.nombre === "Cantina")).toHaveLength(1);
  });

  it("un detalle que nombra una categoría que ya existe entra en ella", async () => {
    const primera = await anotar("cantina 2000");
    const { transaccion } = await decir("gasté 500 en la cantina de la facu");
    expect(transaccion).toMatchObject({
      categoriaId: primera.transacciones[0].categoriaId,
      descripcion: "Cantina de la facu",
      contraparte: "Cantina de la facu",
    });
  });

  it("todas las transferencias van juntas, con la persona como detalle", async () => {
    const plin = await decir("transferencia plin plin 2000");
    const plan = await decir("transferí 5000 a Plan Plan, regalo");
    expect([plin.transaccion, plan.transaccion]).toMatchObject([
      { categoriaId: "transferencias", contraparte: "Plin plin", descripcion: "Plin plin" },
      { categoriaId: "transferencias", contraparte: "Plan Plan", descripcion: "Plan Plan · Regalo" },
    ]);
    expect(sesion.categorias.some((c) => c.nombre.startsWith("Pl"))).toBe(false);
  });

  it("un ingreso va a Ingresos, con su detalle adentro", async () => {
    const { transaccion } = await decir("cobré 250 lucas de sueldo");
    expect(transaccion).toMatchObject({ categoriaId: "ingresos", contraparte: "Sueldo" });
  });

  it("descartar borra la categoría que quedó vacía, pero no una que se usa", async () => {
    const descartada = await decir("kiosco 900");
    await descartar(sesion, descartada.transaccion!.id);
    expect(sesion.categorias.some((c) => c.nombre === "Kiosco")).toBe(false);
    expect((await repo.categorias()).some((c) => c.nombre === "Kiosco")).toBe(false);

    await anotar("cantina 2000");
    const otra = await decir("cantina 100");
    await descartar(sesion, otra.transaccion!.id);
    expect(sesion.categorias.some((c) => c.nombre === "Cantina")).toBe(true);
  });

  it("sin detalle, usa el medio de pago si lo dijiste", async () => {
    const { transaccion } = await decir("pagué 2000 con débito");
    expect(transaccion).toMatchObject({ categoriaId: "debito" });
  });

  it("pasar un gasto a otra categoría limpia la anterior y enseña la regla", async () => {
    await anotar("comida 100");
    const { transaccion } = await decir("almuerzo 6200");
    const comida = sesion.categorias.find((c) => c.nombre === "Comida")!;
    await editar(sesion, transaccion!.id, { categoriaId: comida.id });
    expect(sesion.categorias.some((c) => c.nombre === "Almuerzo")).toBe(false);
    const proximo = await decir("almuerzo 5000");
    expect(proximo.transaccion).toMatchObject({ categoriaId: comida.id, contraparte: "Almuerzo" });
  });
});
