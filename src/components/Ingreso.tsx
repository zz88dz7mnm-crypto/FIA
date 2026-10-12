"use client";

import { useState } from "react";
import { supabase } from "@/lib/datos/cliente";
import { Fia } from "./Fia";

const CAMPO =
  "h-12 w-full rounded-xl border border-linea bg-white px-4 text-[16px] text-tinta outline-none focus:border-birome focus:ring-2 focus:ring-birome/20";

/** Pantalla de entrada. La cuenta se crea desde Supabase: acá solo se inicia sesión. */
export function Ingreso() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setError("");
    const { error: fallo } = await supabase().auth.signInWithPassword({ email: email.trim(), password: clave });
    if (fallo) {
      setError(
        fallo.status === 400
          ? "El email o la contraseña no coinciden."
          : "No pude conectarme. Revisá tu conexión y probá de nuevo.",
      );
      setEntrando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-10">
      <Fia animo={error ? "duda" : entrando ? "pensando" : "tranqui"} className="animate-flotar h-28 w-auto self-start" />
      <h1 className="mt-6 font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-tight">
        Hola, soy Fia.
      </h1>
      <p className="mt-3 text-[17px] leading-snug text-tinta-suave">
        Vos me contás qué gastaste y yo lo anoto. Entrá y seguimos con tus cuentas.
      </p>

      <form onSubmit={entrar} className="mt-8 grid gap-3">
        <label className="grid gap-1.5 text-[13px] font-medium text-tinta-suave">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={CAMPO}
          />
        </label>
        <label className="grid gap-1.5 text-[13px] font-medium text-tinta-suave">
          Contraseña
          <input
            type="password"
            required
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className={CAMPO}
          />
        </label>
        {error && (
          <p role="alert" className="text-[14px] text-rojo">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={entrando}
          className="mt-2 h-12 rounded-full bg-birome text-[16px] font-semibold text-white transition-colors active:bg-birome-oscuro disabled:opacity-60"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
