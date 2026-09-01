import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NexOps Contenido",
  description: "Conexión oficial e historial de datos de Instagram dentro del Portal NexOps.",
};

export default function ContentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
