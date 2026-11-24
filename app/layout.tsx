import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "ATLAS II | Instrutor Inteligente", description: "Instrutor inteligente para trânsito, legislação, neuroeducação, formação e segurança viária." };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}