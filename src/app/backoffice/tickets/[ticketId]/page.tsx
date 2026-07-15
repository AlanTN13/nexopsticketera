import { redirect } from "next/navigation";

import { AddCommentForm, LogoutClientForm, TicketWorkflowForm } from "@/components/forms";
import { AppShell, AreaPill, EmptyState, NavButton, PriorityPill, SectionCard, StatusPill, TimelineDate } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getInternalUsers, getTicketById, getTicketHistory, getUser, getVisibleComments } from "@/lib/queries";
import { withActor } from "@/lib/routing";

export const dynamic = "force-dynamic";

type BackofficeTicketDetailProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function BackofficeTicketDetail({
  params,
}: BackofficeTicketDetailProps) {
  const { ticketId } = await params;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const ticket = getTicketById(db, actor, ticketId);

  if (!ticket) {
    return (
      <AppShell
        eyebrow="Backoffice · Ticket"
        title="Ticket no encontrado"
        description="No pudimos ubicar el ticket solicitado."
        tone="light"
        navigation={[
          { href: withActor("/backoffice/queue", actor.id), label: "Tickets", active: true },
          { href: withActor("/backoffice/companies", actor.id), label: "Empresas" },
          { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
        ]}
        actions={<NavButton href={withActor("/backoffice/queue", actor.id)} label="Volver a tickets" muted tone="light" />}
      >
        <EmptyState title="Nada para mostrar" detail="El ticket no existe o tu sesión no tiene acceso." tone="light" />
      </AppShell>
    );
  }

  const comments = getVisibleComments(db, actor, ticket.id);
  const history = getTicketHistory(db, ticket.id);
  const creator = getUser(db, ticket.createdById);
  const assignee = getUser(db, ticket.assignedToId);
  const company = db.companies.find((item) => item.id === ticket.companyId);
  const internalUsers = getInternalUsers(db);
  const companyPath = company?.slug ?? ticket.companyId;
  const attachments = db.attachments.filter((attachment) => attachment.ticketId === ticket.id);
  const contextUrls = ticket.contextUrls;

  return (
    <AppShell
      eyebrow="Backoffice · Ticket"
      title={`${ticket.code} · ${ticket.title}`}
      description="Vista operativa del caso con cambios de workflow en un lateral persistente y la conversación como foco principal."
      tone="light"
      navigation={[
        { href: withActor("/backoffice/queue", actor.id), label: "Tickets", active: true },
        { href: withActor("/backoffice/companies", actor.id), label: "Empresas" },
        { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
      ]}
      actions={
        <>
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Volver a tickets" muted tone="light" />
          <NavButton href={withActor(`/backoffice/companies/${companyPath}`, actor.id)} label="Ver empresa" muted tone="light" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <SectionCard title="Resumen" description={ticket.description} tone="light">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={ticket.status} />
              <PriorityPill priority={ticket.priority} />
              <AreaPill area={ticket.area} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <MetaItem label="Empresa" value={company?.name ?? "Sin empresa"} />
              <MetaItem label="Solicitante" value={creator?.name ?? "N/D"} />
              <MetaItem label="Asignado" value={assignee?.name ?? "Sin asignar"} />
              <MetaItem label="Actualizado" value={new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.updatedAt))} />
            </div>
            {contextUrls.length > 0 ? (
              <div className="mt-5 grid gap-2">
                {contextUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[18px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] px-4 py-3 text-sm text-[#374151] transition hover:border-[#111827]"
                  >
                    {url}
                  </a>
                ))}
              </div>
            ) : null}
            {attachments.length > 0 ? (
              <div className="mt-5 grid gap-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url === "#" ? undefined : attachment.url}
                    target={attachment.url === "#" ? undefined : "_blank"}
                    rel={attachment.url === "#" ? undefined : "noreferrer"}
                    className="rounded-[18px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] px-4 py-3 text-sm transition hover:border-[#111827]"
                  >
                    <p className="font-medium text-[#111827]">{attachment.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#6b7280]">
                      {attachment.kind} · {attachment.sizeLabel}
                    </p>
                  </a>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Conversación" description="Respuestas públicas e internas del equipo sobre el mismo ticket." tone="light">
            <div className="grid gap-3">
              {comments.map((comment) => {
                const author = getUser(db, comment.authorId);
                return (
                  <div key={comment.id} className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#111827]">{author?.name ?? "N/D"}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">
                          {comment.visibility === "internal" ? "Interno" : "Externo"}
                        </p>
                      </div>
                      <TimelineDate value={comment.createdAt} tone="light" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#4b5563]">{comment.body}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] p-4">
              <AddCommentForm
                actor={actor}
                ticketId={ticket.id}
                returnPath={`/backoffice/tickets/${ticket.id}`}
                allowInternal
                tone="light"
              />
            </div>
          </SectionCard>

          <SectionCard title="Historial" description="Auditoría de cambios de estado, prioridad y comentarios." tone="light">
            <div className="grid gap-2">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 rounded-[18px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] px-4 py-3">
                  <p className="text-sm text-[#374151]">{entry.message}</p>
                  <TimelineDate value={entry.createdAt} tone="light" />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-5 lg:sticky lg:top-6 lg:self-start">
          <SectionCard title="Workflow" description="Panel operativo primario para mover el ticket." tone="light">
            <TicketWorkflowForm
              actor={actor}
              ticketId={ticket.id}
              assignedToId={ticket.assignedToId}
              status={ticket.status}
              priority={ticket.priority}
              internalAgents={internalUsers}
              returnPath={`/backoffice/tickets/${ticket.id}`}
              tone="light"
            />
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[#111827]">{value}</p>
    </div>
  );
}
