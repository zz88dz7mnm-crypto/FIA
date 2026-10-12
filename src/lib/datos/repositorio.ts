import type { Categoria, ReglaPersonal } from "../motor/categorias";
import type { Tipo } from "../motor/interpretar";
import type { DatosMensaje, Estado, Mensaje, Perfil, Transaccion } from "../tipos";

export type NuevaTransaccion = {
  tipo: Tipo;
  centavos: number;
  fecha: string;
  descripcion: string;
  categoriaId: string | null;
  origenMensajeId: string | null;
};

export type CambiosTransaccion = Partial<{
  tipo: Tipo;
  centavos: number;
  fecha: string;
  descripcion: string;
  categoriaId: string | null;
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
  agregarMensaje(mensaje: { autor: Mensaje["autor"]; texto: string; datos?: DatosMensaje }): Promise<Mensaje>;

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
}
