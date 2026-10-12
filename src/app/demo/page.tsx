import { notFound } from "next/navigation";
import { Demo } from "@/components/Demo";

/** Solo en desarrollo: sirve para probar a Fia sin iniciar sesión. */
export default function PaginaDemo() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Demo vista="chat" />;
}
