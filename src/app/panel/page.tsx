import type { Metadata } from "next";
import { Aplicacion } from "@/components/Aplicacion";

export const metadata: Metadata = { title: "Panel · FIA" };

export default function PaginaPanel() {
  return <Aplicacion vista="panel" />;
}
