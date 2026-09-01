import { Pause, Play } from "lucide-react";

import { addObservedAccountAction, retireObservedAccountAction, setObservedAccountActiveAction } from "@/app/portal/contenido/actions";
import { ContentShell, ContentStatus } from "@/components/content/content-shell";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { InlineNotice, SectionCard } from "@/components/ui";
import { getContentPortalContext } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function ContentAccountsPage({ searchParams }: { searchParams: Promise<{ success?: string; company?: string }> }) {
  const params = await searchParams;
  const context = await getContentPortalContext(params.company);
  const observed = context.accounts.filter((account) => account.kind !== "own");
  const counts = {
    competitor: observed.filter((account) => account.kind === "competitor" && account.active).length,
    reference: observed.filter((account) => account.kind === "reference" && account.active).length,
  };
  return (
    <ContentShell context={context} active="accounts" title="Cuentas observadas" description="Administrá competidores y referencias sin borrar el historial ya recolectado.">
      {params.success ? <InlineNotice tone="success">{params.success}</InlineNotice> : null}
      <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title="Agregar cuenta" description={`Competidores ${counts.competitor}/5 · Referencias ${counts.reference}/3`} tone="light">
          {context.canManage ? (
            <PendingForm action={addObservedAccountAction} className="grid gap-3">
              <input type="hidden" name="company" value={context.company.id} />
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Tipo
                <select name="kind" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900">
                  <option value="competitor">Competidor</option>
                  <option value="reference">Referencia</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Usuario de Instagram
                <input name="username" required placeholder="ejemplo.marca" pattern="@?[A-Za-z0-9._]{1,30}" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-950" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Nota opcional
                <textarea name="note" maxLength={500} rows={3} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-950" />
              </label>
              <PendingSubmitButton idleLabel="Agregar a la watchlist" pendingLabel="Agregando…" className="min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800" />
            </PendingForm>
          ) : <p className="text-sm leading-6 text-slate-600">Tu rol tiene acceso de lectura. Un administrador puede cambiar la watchlist.</p>}
        </SectionCard>

        <SectionCard title="Watchlist del workspace" description="Las cuentas personales o privadas se marcan como no compatibles; nunca se usa scraping alternativo." tone="light">
          <div className="grid gap-2">
            {context.accounts.length ? context.accounts.map((account) => (
              <article key={account.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-slate-950">@{account.username}</p><ContentStatus status={account.availabilityStatus} /></div>
                  <p className="mt-1 text-xs text-slate-500">{account.kind === "own" ? "Cuenta propia" : account.kind === "competitor" ? "Competidor" : "Referencia"}{account.lastSyncAt ? ` · última recolección ${new Date(account.lastSyncAt).toLocaleString("es-AR")}` : " · todavía sin recolectar"}</p>
                  {account.note ? <p className="mt-1 text-xs text-slate-600">{account.note}</p> : null}
                  {account.lastAccessAt ? <p className="mt-1 text-[11px] text-slate-400">Último acceso: {new Date(account.lastAccessAt).toLocaleString("es-AR")}</p> : null}
                  {account.lastError ? <p className="mt-1 text-xs text-rose-700">{account.lastError}</p> : null}
                </div>
                {context.canManage && account.kind !== "own" ? (
                  <div className="flex gap-2">
                    <PendingForm action={setObservedAccountActiveAction}>
                      <input type="hidden" name="company" value={context.company.id} />
                      <input type="hidden" name="accountId" value={account.id} /><input type="hidden" name="active" value={account.active ? "false" : "true"} />
                      <PendingSubmitButton aria-label={account.active ? "Pausar cuenta" : "Reactivar cuenta"} idleLabel={account.active ? "Pausar" : "Reactivar"} pendingLabel="Guardando…" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50" />
                    </PendingForm>
                    <PendingForm action={retireObservedAccountAction}>
                      <input type="hidden" name="company" value={context.company.id} />
                      <input type="hidden" name="accountId" value={account.id} />
                      <PendingSubmitButton aria-label="Retirar cuenta" idleLabel="Retirar" pendingLabel="Retirando…" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50" />
                    </PendingForm>
                  </div>
                ) : <span className="text-xs font-semibold text-slate-500">{account.active ? <Play size={14} /> : <Pause size={14} />}</span>}
              </article>
            )) : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-600">Conectá la cuenta propia y agregá la primera cuenta observada.</div>}
          </div>
        </SectionCard>
      </div>
    </ContentShell>
  );
}
