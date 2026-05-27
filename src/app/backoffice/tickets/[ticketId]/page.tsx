import { redirect } from "next/navigation";

import { AddCommentForm, TicketWorkflowForm } from "@/components/forms";
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
        eyebrow="Backoffice"
        title="Ticket no encontrado"
        description="No pudimos ubicar el ticket solicitado."
        tone="light"
        actions={<NavButton href={withActor("/backoffice/queue", actor.id)} label="Volver a la cola" tone="light" />}
      >
        <EmptyState title="Nada para mostrar" detail="Puede haberse reseteado la demo o cambiado el actor actual." tone="light" />
      </AppShell>
    );
  }

  const comments = getVisibleComments(db, actor, ticket.id);
  const history = getTicketHistory(db, ticket.id);
  const creator = getUser(db, ticket.createdById);
  const assignee = getUser(db, ticket.assignedToId);
  const company = db.companies.find((item) => item.id === ticket.companyId);
  const internalUsers = getInternalUsers(db);

  return (
    <AppShell
      eyebrow="Backoffice operativo"
      title={`${ticket.code} · ${ticket.title}`}
      description={ticket.description}
      tone="light"
      actions={
        <>
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Volver a la cola" muted tone="light" />
          <NavButton href={withActor(`/backoffice/companies/${ticket.companyId}`, actor.id)} label="Ver empresa" tone="light" />
        </>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Resumen operativo" description="Contexto del ticket, cuenta asociada y responsables actuales." tone="light">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <p className="text-sm text-[#5a5d7f]">Empresa</p>
              <p className="mt-3 text-sm font-medium text-[#1b1638]">{company?.name ?? "Sin empresa"}</p>
            </div>
            <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <p className="text-sm text-[#5a5d7f]">Solicitante</p>
              <p className="mt-3 text-sm font-medium text-[#1b1638]">{creator?.name ?? "N/D"}</p>
            </div>
            <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <p className="text-sm text-[#5a5d7f]">Estado</p>
              <div className="mt-3"><StatusPill status={ticket.status} /></div>
            </div>
            <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <p className="text-sm text-[#5a5d7f]">Prioridad</p>
              <div className="mt-3"><PriorityPill priority={ticket.priority} /></div>
            </div>
            <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <p className="text-sm text-[#5a5d7f]">Área</p>
              <div className="mt-3"><AreaPill area={ticket.area} /></div>
            </div>
            <div className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <p className="text-sm text-[#5a5d7f]">Asignado</p>
              <p className="mt-3 text-sm font-medium text-[#1b1638]">{assignee?.name ?? "Sin asignar"}</p>
            </div>
          </div>
          <div className="mt-6">
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
          </div>
        </SectionCard>

        <SectionCard title="Conversación y notas" description="Desde acá el equipo interno puede dejar comentarios públicos o privados." tone="light">
          <div className="grid gap-4">
            {comments.map((comment) => {
              const author = getUser(db, comment.authorId);
              return (
                <div key={comment.id} className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#1b1638]">{author?.name ?? "N/D"}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7b74a6]">
                        {comment.visibility === "internal" ? "Interno" : "Externo"}
                      </p>
                    </div>
                    <TimelineDate value={comment.createdAt} tone="light" />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[#5a5d7f]">{comment.body}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <AddCommentForm
              actor={actor}
              ticketId={ticket.id}
              returnPath={`/backoffice/tickets/${ticket.id}`}
              allowInternal
              tone="light"
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Historial auditado" description="Base para auditoría operativa y trazabilidad de cambios sobre la cuenta y el ticket." tone="light">
        <div className="grid gap-3">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-[24px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[#1b1638]">{entry.message}</p>
                <TimelineDate value={entry.createdAt} tone="light" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
