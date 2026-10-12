"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/datos/cliente";
import type { Repositorio } from "@/lib/datos/repositorio";
import { repositorioSupabase } from "@/lib/datos/supabase";
import { Chat } from "./Chat";
import { Fia } from "./Fia";
import { Ingreso } from "./Ingreso";

type Estado =
  | { paso: "cargando" }
  | { paso: "sin_sesion" }
  | { paso: "lista"; clave: string; repo: Repositorio; salir?: () => void };

/** Decide qué mostrar: la espera, la entrada o el chat. */
export function Aplicacion() {
  const [estado, setEstado] = useState<Estado>({ paso: "cargando" });

  useEffect(() => {
    const db = supabase();
    const { data } = db.auth.onAuthStateChange((_evento, sesion) => {
      const usuarioId = sesion?.user.id;
      setEstado((previo) => {
        if (!usuarioId) return { paso: "sin_sesion" };
        if (previo.paso === "lista" && previo.clave === usuarioId) return previo;
        return { paso: "lista", clave: usuarioId, repo: repositorioSupabase(db, usuarioId), salir: () => void db.auth.signOut() };
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (estado.paso === "cargando") {
    return (
      <main className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Cargando">
        <Fia className="size-16 animate-pulse" />
      </main>
    );
  }
  if (estado.paso === "sin_sesion") return <Ingreso />;
  return <Chat key={estado.clave} repo={estado.repo} salir={estado.salir} />;
}
