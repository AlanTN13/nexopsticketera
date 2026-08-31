import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal NexOps",
  description: "Portal de clientes NexOps para gestionar Soporte y consultar Métricas desde una única sesión.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
