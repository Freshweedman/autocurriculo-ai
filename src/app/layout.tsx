import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoCurriculo AI",
  description: "Automacao de candidaturas de emprego com IA",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
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
