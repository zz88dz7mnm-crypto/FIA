"use client";

import { useState } from "react";
import { repositorioEnMemoria } from "@/lib/datos/memoria";
import { Chat } from "./Chat";

/** El chat con datos en memoria: no toca la base y se borra al recargar. */
export function Demo() {
  const [repo] = useState(repositorioEnMemoria);
  return <Chat repo={repo} />;
}
