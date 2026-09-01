import { ExternalLink } from "lucide-react";

import { ContentShell } from "@/components/content/content-shell";
import { SectionCard } from "@/components/ui";
import { getContentPortalContext } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function ContentDataPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  const context = await getContentPortalContext(params.company);
  const accountById = new Map(context.accounts.map((account) => [account.id, account]));
  const latestByAccount = new Map<string, (typeof context.latestSnapshots)[number]>();
  context.latestSnapshots.forEach((snapshot) => {
    if (!latestByAccount.has(snapshot.accountId)) latestByAccount.set(snapshot.accountId, snapshot);
  });
  return (
    <ContentShell context={context} active="data" title="Datos recolectados" description="Inventario verificable de perfiles, publicaciones y métricas crudas. Sin interpretación ni scoring en esta fase.">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-indigo-100 bg-indigo-950 p-4 text-white"><p className="text-xs font-semibold text-indigo-200">Perfiles con snapshot</p><p className="mt-2 text-3xl font-black">{latestByAccount.size}</p></div>
        <div className="rounded-xl border border-sky-100 bg-sky-950 p-4 text-white"><p className="text-xs font-semibold text-sky-200">Publicaciones observadas</p><p className="mt-2 text-3xl font-black">{context.recentMedia.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Frecuencia</p><p className="mt-2 text-2xl font-black text-slate-950">Semanal</p></div>
      </section>

      <SectionCard title="Último estado por cuenta" description="Un valor vacío significa que Meta no lo entregó; no se transforma en cero." tone="light">
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Cuenta</th><th className="px-3 py-2">Observado</th><th className="px-3 py-2">Seguidores</th><th className="px-3 py-2">Seguidos</th><th className="px-3 py-2">Publicaciones</th></tr></thead><tbody className="divide-y divide-slate-100">{Array.from(latestByAccount.values()).map((snapshot) => <tr key={snapshot.id}><td className="px-3 py-3 font-bold text-slate-900">@{accountById.get(snapshot.accountId)?.username ?? "cuenta"}</td><td className="px-3 py-3 text-slate-600">{new Date(snapshot.observedAt).toLocaleString("es-AR")}</td><td className="px-3 py-3 text-slate-700">{snapshot.followersCount ?? "—"}</td><td className="px-3 py-3 text-slate-700">{snapshot.followsCount ?? "—"}</td><td className="px-3 py-3 text-slate-700">{snapshot.mediaCount ?? "—"}</td></tr>)}</tbody></table>{!latestByAccount.size ? <p className="py-10 text-center text-sm text-slate-500">Todavía no hay snapshots.</p> : null}</div>
      </SectionCard>

      <SectionCard title="Publicaciones registradas" description="Identidad estable y primera/última observación de cada publicación." tone="light">
        <div className="grid gap-2">{context.recentMedia.map((media) => <article key={media.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 lg:grid-cols-[150px_minmax(0,1fr)_minmax(280px,auto)] lg:items-center"><div><p className="text-xs font-bold text-slate-950">@{accountById.get(media.accountId)?.username ?? "cuenta"}</p><p className="text-[11px] text-slate-500">{media.mediaType ?? "PUBLICACIÓN"}</p>{media.permalink ? <a href={media.permalink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-indigo-700">Abrir <ExternalLink size={12} /></a> : null}</div><p className="line-clamp-2 text-sm leading-5 text-slate-600">{media.caption || "Sin texto"}</p><div className="grid grid-cols-4 gap-1.5 text-center"><div className="rounded-lg bg-slate-50 p-2"><p className="font-black text-slate-950">{media.metrics?.likeCount ?? "—"}</p><p className="text-[9px] text-slate-500">Me gusta</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="font-black text-slate-950">{media.metrics?.commentsCount ?? "—"}</p><p className="text-[9px] text-slate-500">Comentarios</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="font-black text-slate-950">{media.metrics?.reach ?? "—"}</p><p className="text-[9px] text-slate-500">Alcance</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="font-black text-slate-950">{media.metrics?.views ?? "—"}</p><p className="text-[9px] text-slate-500">Vistas</p></div></div></article>)}{!context.recentMedia.length ? <p className="py-10 text-center text-sm text-slate-500">La primera recolección completará este inventario.</p> : null}</div>
      </SectionCard>
    </ContentShell>
  );
}
