import type { Categoria } from "./categorias";

/** Categorías de ejemplo para pruebas y para el modo demo. Las reales viven en la base. */
export const CATEGORIAS_DE_MUESTRA: Categoria[] = [
  { id: "comida", nombre: "Comida", clase: "gasto", palabrasClave: ["almuerzo", "cena", "cafe", "supermercado", "super", "pizza", "empanada", "delivery", "bar"] },
  { id: "transporte", nombre: "Transporte", clase: "gasto", palabrasClave: ["taxi", "uber", "nafta", "sube", "subte", "colectivo", "estacionamiento", "transporte publico"] },
  { id: "vivienda", nombre: "Vivienda", clase: "gasto", palabrasClave: ["alquiler", "expensas", "luz", "gas", "internet"] },
  { id: "entretenimiento", nombre: "Entretenimiento", clase: "gasto", palabrasClave: ["cine", "recital", "netflix", "spotify"] },
  { id: "salud", nombre: "Salud", clase: "gasto", palabrasClave: ["farmacia", "medico", "obra social", "gimnasio"] },
  { id: "ingresos", nombre: "Ingresos", clase: "ingreso", palabrasClave: ["sueldo", "trabajo", "aguinaldo", "devolucion", "venta"] },
  { id: "transferencias", nombre: "Transferencias", clase: "gasto", palabrasClave: [] },
  { id: "tarjeta", nombre: "Pagos con tarjeta", clase: "gasto", palabrasClave: [] },
  { id: "qr", nombre: "Pagos con QR", clase: "gasto", palabrasClave: [] },
  { id: "impuestos", nombre: "Impuestos", clase: "gasto", palabrasClave: ["impuesto", "monotributo", "afip", "arca"] },
  { id: "rendimientos", nombre: "Rendimientos diarios", clase: "ingreso", palabrasClave: [] },
  { id: "propias", nombre: "Entre mis cuentas", clase: "gasto", palabrasClave: [] },
];
