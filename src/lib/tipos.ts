import type { Periodo } from "./motor/fechas";
import type { Borrador, OpcionImporte, Tipo } from "./motor/interpretar";

export type Estado = "recibida" | "en_revision" | "confirmada" | "rechazada" | "anulada";

export type Transaccion = {
  id: string;
  tipo: Tipo;
  centavos: number;
  fecha: string;
  descripcion: string;
  categoriaId: string | null;
  /** Frasco del que se descuenta, si tiene. */
  frascoId: string | null;
  /** Con quién fue: la persona de una transferencia o el comercio de un pago. */
  contraparte: string | null;
  /** Movimiento entre cuentas propias: queda anotado pero no cuenta en los totales. */
  interna: boolean;
  /** Número de operación leído de un comprobante, si lo hay. */
  referencia: string | null;
  /** Cómo se cargó: escrito en el chat o leído de una captura. */
  metodo: "texto" | "imagen" | "manual";
  estado: Estado;
  creadoEn: string;
};

/** Un frasco con sus cuentas: lo que se le puso y lo que ya se gastó de ahí. */
export type EstadoFrasco = { id: string; nombre: string; asignado: number; gastado: number };

/** Algo de un movimiento propuesto que conviene mirar antes de anotarlo. */
export type Aviso = "duplicado" | "importe_dudoso" | "sentido" | "sin_fecha" | "propia";

export type Resumen = {
  periodo: Periodo;
  desde: string;
  entradas: number;
  salidas: number;
  /** Salidas agrupadas, de mayor a menor. */
  porCategoria: { nombre: string; centavos: number }[];
};

/** Contenido estructurado de un mensaje de Fia; define cómo se dibuja en el chat. */
export type DatosMensaje =
  | { clase: "texto" }
  | { clase: "ejemplos" }
  | { clase: "pide_nombre" }
  | { clase: "propuesta"; transaccionId: string; aviso?: "duplicado" | "importe_dudoso" }
  /** Mensaje del usuario que era una imagen. El texto leído queda guardado aparte. */
  | { clase: "captura" }
  /** Los movimientos encontrados en una captura, cada uno para revisar por separado. */
  | { clase: "lote"; transaccionIds: string[]; avisos: Record<string, Aviso[]> }
  | { clase: "frascos"; frascos: EstadoFrasco[] }
  /** Fia pide confirmación antes de borrar todo un mes. */
  | { clase: "confirmar_borrado"; desde: string; hasta: string }
  | {
      clase: "pregunta";
      falta: "importe" | "tipo";
      borrador: Borrador;
      opcionesImporte: OpcionImporte[];
      opcionesTipo: Tipo[];
      origenMensajeId: string;
    }
  | { clase: "resumen"; resumen: Resumen }
  | { clase: "lista"; transaccionIds: string[] };

export type Mensaje = {
  id: string;
  autor: "usuario" | "fia";
  texto: string;
  datos: DatosMensaje;
  creadoEn: string;
};

export type Perfil = { nombre: string | null; zonaHoraria: string };

export const NOMBRE_DE_TIPO: Record<Tipo, string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  transferencia_enviada: "Transferencia enviada",
  transferencia_recibida: "Transferencia recibida",
};

/** ¿El movimiento suma (entra plata) o resta (sale plata)? */
export const ES_ENTRADA: Record<Tipo, boolean> = {
  gasto: false,
  ingreso: true,
  transferencia_enviada: false,
  transferencia_recibida: true,
};
