import { redirect } from "next/navigation";

import { AddCommentForm, LogoutClientForm } from "@/components/forms";
import { AppShell, AreaPill, EmptyState, NavButton, PriorityPill, SectionCard, StatusPill, TimelineDate } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { getTicketById, getTicketHistory, getUser, getVisibleComments } from "@/lib/queries";
import { areaLabels, canCommentOnTickets, canManageOperations, formatRelativeDate, priorityLabels, statusLabels, typeLabels } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

type TicketDetailProps = {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalTicketDetail({ params, searchParams }: TicketDetailProps) {
  const [{ ticketId }] = await Promise.all([params, searchParams]);
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const ticket = getTicketById(db, actor, ticketId);

  if (!ticket) {
    return (
      <AppShell
        eyebrow="Portal cliente · Ticket"
        title="Ticket no encontrado"
        description="No pudimos mostrar este ticket."
        tone="light"
        navigation={[
          { href: "/portal", label: "Tickets", active: true },
          { href: "/portal/users", label: "Usuarios" },
        ]}
        actions={<NavButton href="/portal" label="Volver a tickets" muted tone="light" />}
      >
        <EmptyState title="Este ticket no existe o no pertenece a tu empresa" detail="Volvé al portal para seguir con otra solicitud o crear un ticket nuevo." tone="light" />
      </AppShell>
    );
  }

  const comments = getVisibleComments(db, actor, ticket.id);
  const history = getTicketHistory(db, ticket.id);
  const creator = getUser(db, ticket.createdById);
  const assignee = getUser(db, ticket.assignedToId);
  const attachments = db.attachments.filter((attachment) => attachment.ticketId === ticket.id);
  const contextUrls = ticket.contextUrls;

  return (
    <AppShell
      eyebrow="Portal cliente · Ticket"
      title={`${ticket.code} · ${ticket.title}`}
      description="Seguimiento del caso, comentarios e historial en una sola vista."
      tone="light"
      navigation={[
        { href: "/portal", label: "Tickets", active: true },
        { href: "/portal/users", label: "Usuarios" },
      ]}
      actions={
        <>
          <NavButton href="/portal" label="Volver a tickets" muted tone="light" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <SectionCard title="Resumen del ticket" description={ticket.description} tone="light">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={ticket.status} />
              <PriorityPill priority={ticket.priority} />
              <AreaPill area={ticket.area} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <MetaItem label="Tipo" value={typeLabels[ticket.type]} />
              <MetaItem label="Área" value={areaLabels[ticket.area]} />
              <MetaItem label="Prioridad" value={priorityLabels[ticket.priority]} />
              <MetaItem label="Estado" value={statusLabels[ticket.status]} />
              <MetaItem label="Creado por" value={creator?.name ?? "N/D"} />
              <MetaItem label="Asignado" value={assignee?.name ?? "Sin asignar"} />
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

          <SectionCard title="Conversación" description="Toda la interacción sobre el caso vive acá." tone="light">
            <div className="grid gap-3">
              {comments.length > 0 ? (
                comments.map((comment) => {
                  const author = getUser(db, comment.authorId);
                  return (
                    <article key={comment.id} className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#111827]">{author?.name ?? "N/D"}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#6b7280]">
                            {comment.visibility === "internal" ? "Nota interna" : "Comentario visible"}
                          </p>
                        </div>
                        <TimelineDate value={comment.createdAt} tone="light" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#4b5563]">{comment.body}</p>
                    </article>
                  );
                })
              ) : (
                <EmptyState title="Todavía no hay comentarios visibles" detail="Cuando haya respuesta o nuevos mensajes, los vas a ver acá." tone="light" />
              )}
            </div>

            <div className="mt-5 rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] p-4">
              {canCommentOnTickets(actor.role) ? (
                <AddCommentForm
                  actor={actor}
                  ticketId={ticket.id}
                  returnPath={`/portal/tickets/${ticket.id}`}
                  allowInternal={canManageOperations(actor.role)}
                  tone="light"
                />
              ) : (
                <EmptyState title="Sin permisos para comentar" detail="Tu rol puede seguir el ticket, pero no publicar comentarios." tone="light" />
              )}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-5 lg:sticky lg:top-6 lg:self-start">
          <SectionCard title="Actividad" description="Resumen rápido del estado del caso." tone="light">
            <div className="grid gap-3">
              <MetaItem label="Última actualización" value={formatRelativeDate(ticket.updatedAt)} />
              <MetaItem label="Adjuntos" value={attachments.length > 0 ? `${attachments.length} archivo(s)` : "Sin adjuntos"} />
              <MetaItem label="Links" value={contextUrls.length > 0 ? `${contextUrls.length} link(s)` : "Sin links"} />
              <MetaItem label="Comentarios" value={String(comments.length)} />
            </div>
          </SectionCard>

          <SectionCard title="Historial" description="Trazabilidad del caso." tone="light">
            <div className="grid gap-2">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-[18px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] px-4 py-3">
                  <p className="text-sm text-[#374151]">{entry.message}</p>
                  <div className="mt-2">
                    <TimelineDate value={entry.createdAt} tone="light" />
                  </div>
                </div>
              ))}
            </div>
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
