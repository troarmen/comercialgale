import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { scriptTema } from "@/components/alternar-tema";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Galé Comercial",
  description: "Catálogo de atacado da Galé Lingerie",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/*
          Aplica o tema salvo antes da primeira pintura, evitando o flash
          branco. Precisa ser inline e síncrono — um <script src> chegaria
          tarde demais. `suppressHydrationWarning` no <html> porque este
          script altera o atributo antes do React comparar a árvore.
        */}
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
