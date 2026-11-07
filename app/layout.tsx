import "@fontsource/libre-caslon-text/400.css";
import "@fontsource/libre-caslon-text/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Atlas Historiográfico", description: "Estudos sistemáticos de História com fontes acadêmicas verificadas, mapas e ABNT." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
