"use client";

import { useState } from "react";
import { supabase } from "@/lib/datos/cliente";
import { Fia } from "./Fia";

const CAMPO =
  "h-12 w-full rounded-2xl border border-black/8 bg-white/80 px-4 text-[17px] text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/20";

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
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="cristal w-full max-w-sm rounded-[32px] p-7">
        <Fia className="size-14" />
        <h1 className="mt-5 text-[34px] leading-[1.1] font-bold tracking-[-0.025em]">Fia</h1>
        <p className="mt-2 text-[17px] leading-snug text-tinta-suave">Vos le contás qué gastaste y ella lo anota. Entrá y seguí con tus cuentas.</p>

        <form onSubmit={entrar} className="mt-7 grid gap-3">
          <label className="grid gap-1.5 text-[13px] text-tinta-suave">
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
          <label className="grid gap-1.5 text-[13px] text-tinta-suave">
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
            <p role="alert" className="text-[15px] text-rojo">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={entrando}
            className="mt-2 h-12 rounded-full bg-acento text-[17px] font-semibold text-white transition-colors active:bg-acento-oscuro disabled:opacity-60"
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
