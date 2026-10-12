import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FIA",
  description: "Contale a Fia qué gastaste y ella lo anota.",
  appleWebApp: { capable: true, title: "FIA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f3f7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR">
      <body className="font-sans">{children}</body>
    </html>
  );
}
