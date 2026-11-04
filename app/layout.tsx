import type { Metadata, Viewport } from "next";
import "@fontsource-variable/google-sans-flex/opsz.css";
import "@fontsource-variable/material-symbols-rounded/fill.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concurso",
  description: "Concurso de preguntas con pulsadores para dos equipos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
