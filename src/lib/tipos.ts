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
  estado: Estado;
  creadoEn: string;
};

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
