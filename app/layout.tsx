import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "ATLAS | Assistente Pessoal", description: "Assistente pessoal inteligente com voz, tarefas e autonomia controlada." };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}