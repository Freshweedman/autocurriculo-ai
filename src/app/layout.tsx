import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoCurriculo AI - Envio automatico de curriculos",
  description: "SaaS de automacao de candidaturas de emprego",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
