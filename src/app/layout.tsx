import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NexOps Help Center",
  description: "Portal cliente de NexOps para reportar incidencias, gestionar tickets y seguir su estado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${roboto.variable} ${montserrat.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
