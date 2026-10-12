import type { Categoria } from "./categorias";

/**
 * Categorías de ejemplo para pruebas y para el modo demo; las reales viven en la base.
 * Son todas por tipo de operación: cómo se movió la plata, no en qué se gastó.
 */
export const CATEGORIAS_DE_MUESTRA: Categoria[] = [
  { id: "transferencias", nombre: "Transferencias", clase: "gasto", palabrasClave: [] },
  { id: "debito", nombre: "Pagos con tarjeta de débito", clase: "gasto", palabrasClave: ["debito", "tarjeta de debito"] },
  { id: "credito", nombre: "Pagos con tarjeta de crédito", clase: "gasto", palabrasClave: ["credito", "tarjeta de credito", "cuotas"] },
  { id: "qr", nombre: "Pagos con QR", clase: "gasto", palabrasClave: ["qr"] },
  { id: "servicios", nombre: "Pagos de servicios", clase: "gasto", palabrasClave: ["pago de servicio", "recarga", "sube"] },
  { id: "extracciones", nombre: "Extracciones de efectivo", clase: "gasto", palabrasClave: ["extraccion", "cajero", "retiro de efectivo"] },
  { id: "impuestos", nombre: "Impuestos", clase: "gasto", palabrasClave: ["impuesto", "monotributo", "afip", "arca"] },
  { id: "ingresos", nombre: "Ingresos", clase: "ingreso", palabrasClave: ["sueldo", "trabajo", "aguinaldo", "devolucion", "venta"] },
  { id: "rendimientos", nombre: "Rendimientos diarios", clase: "ingreso", palabrasClave: ["rendimiento"] },
  { id: "propias", nombre: "Entre mis cuentas", clase: "gasto", palabrasClave: [] },
];
