export default function BackofficeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,91,255,0.08),transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 top-auto h-72 bg-[radial-gradient(circle_at_bottom,rgba(17,24,39,0.06),transparent_72%)]" />
      <div className="relative">{children}</div>
    </main>
  );
}
