import type { Categoria, ReglaPersonal } from "../motor/categorias";
import type { Tipo } from "../motor/interpretar";
import type { DatosMensaje, Estado, EstadoFrasco, Mensaje, Perfil, Transaccion } from "../tipos";

export type NuevaTransaccion = {
  tipo: Tipo;
  centavos: number;
  fecha: string;
  descripcion: string;
  categoriaId: string | null;
  origenMensajeId: string | null;
  frascoId?: string | null;
  /** Cómo llegó: escrito en el chat o leído de una captura. */
  metodo?: "texto" | "imagen";
  contraparte?: string | null;
  referencia?: string | null;
};

export type CambiosTransaccion = Partial<{
  tipo: Tipo;
  centavos: number;
  fecha: string;
  descripcion: string;
  categoriaId: string | null;
  frascoId: string | null;
  estado: Estado;
}>;

/** Todo lo que Fia necesita guardar o leer. Hay una versión real (Supabase) y otra en memoria. */
export interface Repositorio {
  /** Devuelve el perfil del usuario; lo crea la primera vez. */
  perfil(): Promise<Perfil>;
  guardarNombre(nombre: string): Promise<void>;
  categorias(): Promise<Categoria[]>;
  reglas(): Promise<ReglaPersonal[]>;

  /** Los últimos mensajes del chat, del más viejo al más nuevo. */
  mensajes(limite: number): Promise<Mensaje[]>;
  /** `textoExtraido` es lo que se leyó de una imagen: queda guardado como origen del registro. */
  agregarMensaje(mensaje: { autor: Mensaje["autor"]; texto: string; datos?: DatosMensaje; textoExtraido?: string }): Promise<Mensaje>;

  transaccionesPorId(ids: string[]): Promise<Transaccion[]>;
  /** Siempre entra "en revisión": solo cuenta cuando el usuario la confirma. */
  crearTransaccion(nueva: NuevaTransaccion): Promise<Transaccion>;
  actualizarTransaccion(id: string, cambios: CambiosTransaccion): Promise<Transaccion>;
  /** Movimientos vigentes con el mismo tipo, importe y fecha: posibles duplicados. */
  parecidas(a: { tipo: Tipo; centavos: number; fecha: string }): Promise<Transaccion[]>;
  /** Confirmadas con fecha dentro del rango (inclusive). */
  confirmadasEntre(desde: string, hasta: string): Promise<Transaccion[]>;
  /** Las últimas confirmadas, de la más nueva a la más vieja. */
  ultimas(limite: number): Promise<Transaccion[]>;

  /** Los frascos con lo asignado y lo gastado (solo cuentan los gastos confirmados). */
  frascos(): Promise<EstadoFrasco[]>;
  crearFrasco(nombre: string): Promise<{ id: string; nombre: string }>;
  /** Pone plata en un frasco; con importe negativo, la saca. */
  aportarAFrasco(id: string, centavos: number): Promise<void>;
  /** Borra el frasco. Sus gastos siguen anotados, ya sin frasco. */
  borrarFrasco(id: string): Promise<void>;
}

/** Error de la base, con su código para poder distinguir los casos que tienen arreglo. */
export class ErrorDeDatos extends Error {
  constructor(mensaje: string, readonly codigo?: string) {
    super(mensaje);
  }

  /** La base no tiene una tabla o columna que la app necesita: falta correr el SQL nuevo. */
  get baseDesactualizada(): boolean {
    return ["42703", "42P01", "PGRST204", "PGRST205"].includes(this.codigo ?? "");
  }
}
