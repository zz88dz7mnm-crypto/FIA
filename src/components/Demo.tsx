"use client";

import { useState } from "react";
import { repositorioEnMemoria } from "@/lib/datos/memoria";
import { repositorioDeMuestra } from "@/lib/datos/muestra";
import { Chat } from "./Chat";
import { Panel } from "./Panel";

/** Las pantallas con datos en memoria: no tocan la base y se borran al recargar. */
export function Demo({ vista }: { vista: "chat" | "panel" }) {
  const [repo] = useState(vista === "panel" ? repositorioDeMuestra : repositorioEnMemoria);
  return vista === "panel" ? <Panel repo={repo} rutaChat="/demo" /> : <Chat repo={repo} rutaPanel="/demo/panel" />;
}
