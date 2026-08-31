import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import {
  AppShell,
  EmptyState,
  Pill,
  SectionCard,
  SidebarUserCard,
  StatCard,
} from "@/components/ui";
import { getAuthenticatedActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import {
  buildPortalNavigation,
  getRadarWorkspaceId,
  resolveRadarCompanyForActor,
} from "@/lib/portal-modules";
import {
  RadarDecision,
  RadarPublication,
  RadarSourceState,
  loadRadarWorkspace,
} from "@/lib/radar-workspace";
import { withActor } from "@/lib/routing";
import { isInternalRole } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function SourceState({ label, state }: { label: string; state: RadarSourceState }) {
  const presentation = {
    ready: { text: "Conectado", tone: "success" as const },
    unavailable: { text: "Pendiente de configurar", tone: "warning" as const },
    error: { text: "Con inconvenientes", tone: "danger" as const },
  }[state];

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Pill tone={presentation.tone}>{presentation.text}</Pill>
    </div>
  );
}

function PublicationCard({ publication }: { publication: RadarPublication }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="success">Publicada</Pill>
          <Pill tone="neutral">{publication.category}</Pill>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Puntaje {publication.score}/100
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold leading-6 text-slate-950">{publication.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{publication.summary}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <span className="text-xs text-slate-500">Publicada el {formatDate(publication.publishedAt)}</span>
        <a
          href={publication.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-violet-700 underline-offset-4 hover:underline"
        >
          Ver publicación
        </a>
      </div>
    </article>
  );
}

function DecisionCard({ decision }: { decision: RadarDecision }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="warning">No publicada</Pill>
          <Pill tone="neutral">{decision.category}</Pill>
        </div>
        <span className="text-xs font-semibold text-slate-500">Puntaje {decision.score}/100</span>
      </div>
      <h3 className="mt-3 text-base font-bold leading-6 text-slate-950">{decision.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{decision.reason}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">Evaluada el {formatDate(decision.detectedAt)}</span>
        <a
          href={decision.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-violet-700 underline-offset-4 hover:underline"
        >
          Ver fuente
        </a>
      </div>
    </article>
  );
}

export default async function PortalRadarPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const internalActor = isInternalRole(actor.role);
  const company = resolveRadarCompanyForActor(db.companies, actor);
  if (!company) {
    redirect(internalActor ? "/backoffice/queue" : "/portal/login?reason=company");
  }
  if (!company.modules.radar.enabled) redirect("/portal");

  const ticketCount = db.tickets.filter((ticket) => ticket.companyId === company.id).length;
  const workspaceId = getRadarWorkspaceId(company);
  const navigation = internalActor
    ? [
        { href: withActor("/backoffice/queue", actor.id), label: "Tickets" },
        { href: withActor("/backoffice/companies", actor.id), label: "Empresas" },
        { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
        { href: "/portal/radar", label: "Radar", active: true },
      ]
    : buildPortalNavigation({
        active: "radar",
        modules: company.modules,
        ticketCount,
      });
  const workspaceLabel = internalActor ? "NexOps" : company.name;
  const sidebarFooter = (
    <SidebarUserCard name={actor.name} detail={internalActor ? "NexOps Tech" : company.name}>
      <LogoutClientForm tone="light" />
    </SidebarUserCard>
  );

  if (!workspaceId) {
    return (
      <AppShell
        eyebrow={internalActor ? "Backoffice · Radar" : "Portal NexOps · Radar"}
        title="Radar"
        description={`La vigilancia de oportunidades de ${workspaceLabel}, dentro del mismo Portal.`}
        tone="light"
        navigation={navigation}
        sidebarFooter={sidebarFooter}
      >
        <EmptyState
          title="Radar está habilitado, pero todavía no tiene un espacio asignado"
          detail="NexOps debe vincular esta empresa con su workspace antes de consultar o mostrar información. Hasta entonces no se carga ningún dato de otra empresa."
          tone="light"
        />
      </AppShell>
    );
  }

  const workspace = await loadRadarWorkspace(workspaceId);
  const businessDecisions = workspace.decisions.filter((decision) => decision.kind === "opportunity");
  const averageScore = workspace.publications.length
    ? Math.round(
        workspace.publications.reduce((total, publication) => total + publication.score, 0) /
          workspace.publications.length,
      )
    : 0;
  const latestPublication = workspace.publications[0] ?? null;

  return (
    <AppShell
      eyebrow={internalActor ? "Backoffice · Radar" : "Portal NexOps · Radar"}
      title="Radar"
      description={`Oportunidades, decisiones y publicaciones de ${workspaceLabel}, sin salir del Portal.`}
      tone="light"
      navigation={navigation}
      sidebarFooter={sidebarFooter}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Publicaciones"
          value={workspace.publications.length}
          detail="Contenido real publicado por Radar"
          tone="light"
        />
        <StatCard
          label="Puntaje promedio"
          value={averageScore || "—"}
          detail="Calidad de las publicaciones detectadas"
          tone="light"
        />
        <StatCard
          label="Oportunidades descartadas"
          value={businessDecisions.length}
          detail="Decisiones editoriales conservadas en historial"
          tone="light"
        />
        <StatCard
          label="Última publicación"
          value={latestPublication ? formatDate(latestPublication.publishedAt) : "—"}
          detail="Fecha del último contenido verificado"
          tone="light"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-5">
          <SectionCard
            title="Publicaciones recientes"
            description="Resultados reales aprobados y publicados por Radar."
            tone="light"
          >
            {workspace.publications.length ? (
              <div className="grid gap-3">
                {workspace.publications.slice(0, 8).map((publication) => (
                  <PublicationCard key={publication.id} publication={publication} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  workspace.publicationsState === "error"
                    ? "No pudimos consultar las publicaciones"
                    : "Todavía no hay publicaciones"
                }
                detail={
                  workspace.publicationsState === "error"
                    ? "Radar sigue aislado y el Portal no muestra datos incompletos. NexOps ya puede revisar la conexión."
                    : "Las publicaciones aprobadas aparecerán acá cuando Radar complete su próximo ciclo."
                }
                tone="light"
              />
            )}
          </SectionCard>

          <SectionCard
            title="Decisiones recientes"
            description="Oportunidades evaluadas que no alcanzaron el criterio de publicación."
            tone="light"
          >
            {businessDecisions.length ? (
              <div className="grid gap-3">
                {businessDecisions.slice(0, 8).map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  workspace.historyState === "ready"
                    ? "No hay oportunidades descartadas"
                    : "Historial todavía no disponible"
                }
                detail={
                  workspace.historyState === "error"
                    ? "La fuente privada no respondió. Las publicaciones siguen disponibles y no se expuso información sin validar."
                    : workspace.historyState === "unavailable"
                      ? "Falta conectar la credencial privada de solo lectura para completar este historial."
                      : "Radar no registró descartes comerciales para este workspace."
                }
                tone="light"
              />
            )}
          </SectionCard>
        </div>

        <div className="grid content-start gap-5">
          <SectionCard
            title="Estado de Radar"
            description="Salud de las dos fuentes que alimentan este módulo."
            tone="light"
          >
            <div>
              <SourceState label="Publicaciones" state={workspace.publicationsState} />
              <SourceState label="Historial privado" state={workspace.historyState} />
            </div>
          </SectionCard>

          <SectionCard title="Espacio asignado" tone="light">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</dt>
                <dd className="mt-1 font-semibold text-slate-900">{company.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</dt>
                <dd className="mt-1 font-mono text-xs text-slate-700">{workspace.workspaceId}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actualización</dt>
                <dd className="mt-1 text-slate-700">
                  {workspace.generatedAt ? formatDate(workspace.generatedAt) : "Sin actualización disponible"}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
