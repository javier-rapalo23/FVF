import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

// Geist para interfaz, Geist Mono para cifras, códigos y teclas. El contraste
// entre ambas es el que sostiene la jerarquía: no hay color decorativo.
const sans = Geist({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inversiones Ferrera",
  description: "Sistema de punto de venta y gestión para verdulería / minimarket",
};

// Fija el tema antes del primer pintado para que no parpadee en claro. Usa la
// elección guardada en el dispositivo o, si no hay, la preferencia del sistema.
const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");if(t!=="claro"&&t!=="oscuro")t=matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // El script modifica `data-tema` antes de hidratar.
    <html lang="es" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-screen bg-lienzo font-sans text-tinta antialiased">
        {children}
      </body>
    </html>
  );
}
