import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radar by NexOps",
  description: "Inteligencia editorial autónoma: oportunidades, decisiones y publicaciones verificadas.",
};

export default function RadarLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
