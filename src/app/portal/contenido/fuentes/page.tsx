import Link from "next/link";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";

import { selectMetaAccountAction } from "@/app/portal/contenido/actions";
import { ContentShell, ContentStatus } from "@/components/content/content-shell";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { InlineNotice, SectionCard } from "@/components/ui";
import { getContentPortalContext } from "@/lib/content-store";
import { META_REQUIRED_SCOPES } from "@/lib/meta-instagram";

export const dynamic = "force-dynamic";

export default async function ContentSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await getContentPortalContext();
  const connection = context.connection;
  return (
    <ContentShell context={context} active="sources" title="Fuentes oficiales" description="Conectá la cuenta propia y verificá exactamente qué acceso usa NexOps para recolectar datos.">
      {params.success ? <InlineNotice tone="success">{params.success}</InlineNotice> : null}
      {params.error ? <InlineNotice tone="error">{params.error}</InlineNotice> : null}
      {!context.metaConfigured ? (
        <InlineNotice tone="info">La aplicación de Meta está lista en código, pero todavía requiere las credenciales y el callback oficial del entorno.</InlineNotice>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <SectionCard title="Instagram profesional" description="Instagram API with Facebook Login · conexión de solo lectura" tone="light" actions={<ContentStatus status={connection?.status ?? "authorization_required"} />}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"><KeyRound size={18} /></span>
              <div>
                <p className="font-bold text-slate-950">{connection?.instagramUsername ? `@${connection.instagramUsername}` : "Sin cuenta conectada"}</p>
                <p className="mt-1 text-sm text-slate-600">{connection?.facebookPageName ?? "La cuenta debe ser profesional y estar vinculada a una Página de Facebook."}</p>
              </div>
            </div>
            {context.canManage ? (
              context.metaConfigured ? (
                <Link href="/api/meta/instagram/connect" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800">
                  {connection?.status === "connected" ? "Reconectar con Meta" : "Conectar con Meta"}
                </Link>
              ) : (
                <button disabled className="mt-4 min-h-10 cursor-not-allowed rounded-lg bg-slate-200 px-4 text-sm font-bold text-slate-500">Conectar con Meta</button>
              )
            ) : <p className="mt-4 text-xs text-slate-500">Solo un administrador puede cambiar esta conexión.</p>}
          </div>

          {connection?.status === "selection_required" && context.canManage ? (
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-bold text-slate-950">Elegí la cuenta profesional</p>
              {connection.selectionOptions.map((option) => (
                <PendingForm key={option.instagramUserId} action={selectMetaAccountAction} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <input type="hidden" name="instagramUserId" value={option.instagramUserId} />
                  <div><p className="text-sm font-bold text-slate-900">@{option.instagramUsername ?? option.instagramUserId}</p><p className="text-xs text-slate-600">{option.pageName}</p></div>
                  <PendingSubmitButton idleLabel="Usar esta" pendingLabel="Conectando…" className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white" />
                </PendingForm>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Alcance autorizado" description="Sin publicación, mensajes, comentarios ni anuncios." tone="light">
          <div className="grid gap-2">
            {META_REQUIRED_SCOPES.map((scope) => (
              <div key={scope} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <span className="font-mono text-xs text-slate-700">{scope}</span>
                {connection?.authorizedScopes.includes(scope) ? <CheckCircle2 size={16} className="text-emerald-600" /> : <span className="size-2 rounded-full bg-slate-300" />}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 rounded-lg bg-indigo-50 p-3 text-xs leading-5 text-indigo-900"><ShieldCheck size={17} className="mt-0.5 shrink-0" />Los tokens se cifran del lado servidor y nunca forman parte del Portal ni de sus respuestas.</div>
        </SectionCard>
      </div>
    </ContentShell>
  );
}
