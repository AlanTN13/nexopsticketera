export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#efeefe_0%,#dfe3ff_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(196,198,255,0.55),transparent_52%)]" />
      <div className="absolute inset-x-0 bottom-0 top-auto h-80 bg-[radial-gradient(circle_at_bottom,rgba(124,91,255,0.16),transparent_70%)]" />
      <div className="relative">{children}</div>
    </main>
  );
}
