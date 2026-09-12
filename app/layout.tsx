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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-lienzo font-sans text-tinta antialiased">
        {children}
      </body>
    </html>
  );
}
