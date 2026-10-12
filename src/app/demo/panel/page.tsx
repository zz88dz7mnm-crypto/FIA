import { notFound } from "next/navigation";
import { Demo } from "@/components/Demo";

/** Solo en desarrollo: el panel con movimientos de muestra. */
export default function PaginaDemoPanel() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Demo vista="panel" />;
}
