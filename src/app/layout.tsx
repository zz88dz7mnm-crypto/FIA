import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Onest } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const onest = Onest({ variable: "--font-onest", subsets: ["latin"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "FIA",
  description: "Contale a Fia qué gastaste y ella lo anota.",
  appleWebApp: { capable: true, title: "FIA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eceff5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${bricolage.variable} ${onest.variable} ${dmMono.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
