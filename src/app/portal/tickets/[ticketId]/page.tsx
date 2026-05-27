import Link from "next/link";
import { redirect } from "next/navigation";

import { AddCommentForm, LogoutClientForm } from "@/components/forms";
import { AreaPill, EmptyState, PriorityPill, StatusPill } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { getTicketById, getTicketHistory, getUser, getVisibleComments } from "@/lib/queries";
import { areaLabels, canManageOperations, formatRelativeDate, priorityLabels, statusLabels, typeLabels } from "@/lib/ticketing";

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
    redirect("/login");
  }

  const ticket = getTicketById(db, actor, ticketId);

  if (!ticket) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="rounded-[32px] border border-[rgba(196,198,255,0.66)] bg-white p-6 text-[#1b1638] shadow-[0_24px_70px_rgba(6,4,20,0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Ticket no encontrado
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#1b1638]">
                No pudimos mostrar este ticket.
              </h1>
            </div>
            <Link
              href="/portal"
              className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] px-4 py-2.5 text-sm font-medium text-white transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            >
              Volver al portal
            </Link>
          </div>
          <div className="mt-6 rounded-[28px] border border-[rgba(91,72,199,0.16)] bg-[#faf9ff] p-1">
            <EmptyState
              title="Este ticket no existe o no pertenece a tu empresa"
              detail="Volvé al portal para seguir con otra solicitud o crear un ticket nuevo."
              tone="light"
            />
          </div>
        </div>
      </div>
    );
  }

  const comments = getVisibleComments(db, actor, ticket.id);
  const history = getTicketHistory(db, ticket.id);
  const creator = getUser(db, ticket.createdById);
  const assignee = getUser(db, ticket.assignedToId);
  const attachments = db.attachments.filter((attachment) => attachment.ticketId === ticket.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="rounded-[30px] border border-[rgba(67,48,166,0.16)] bg-white/72 px-5 py-4 shadow-[0_24px_70px_rgba(124,91,255,0.12)] backdrop-blur sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7c5bff,#4330a6)] text-lg font-black text-white shadow-[0_16px_40px_rgba(124,91,255,0.28)]">
                N
              </div>
              <div>
                <p className="text-base font-bold tracking-tight text-[#1b1638]">NexOps</p>
                <p className="font-[family-name:var(--font-montserrat)] text-xs uppercase tracking-[0.28em] text-[#5b48c7]">
                  Seguimiento de ticket
                </p>
              </div>
            </div>
            <div>
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                {ticket.code}
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.04em] text-[#1b1638] sm:text-4xl">
                {ticket.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5a5d7f]">{ticket.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/portal"
              className="inline-flex items-center rounded-full border border-[rgba(67,48,166,0.14)] bg-white/80 px-4 py-2.5 text-sm font-medium text-[#1b1638] transition hover:border-[#7c5bff] hover:bg-white"
            >
              Volver al portal
            </Link>
            <LogoutClientForm tone="light" />
          </div>
        </div>
      </header>

      <main className="mt-8 grid gap-8">
        <section className="rounded-[32px] border border-[rgba(196,198,255,0.74)] bg-[linear-gradient(180deg,rgba(249,248,255,0.97),rgba(239,236,255,0.94))] p-6 text-[#1b1638] shadow-[0_24px_70px_rgba(6,4,20,0.18)] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={ticket.status} />
                <PriorityPill priority={ticket.priority} />
                <AreaPill area={ticket.area} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Tipo" value={typeLabels[ticket.type]} />
                <SummaryItem label="Área" value={areaLabels[ticket.area]} />
                <SummaryItem label="Prioridad" value={priorityLabels[ticket.priority]} />
                <SummaryItem label="Estado" value={statusLabels[ticket.status]} />
                <SummaryItem label="Creado por" value={creator?.name ?? "N/D"} />
                <SummaryItem label="Asignado a" value={assignee?.name ?? "Sin asignar"} />
              </div>
            </div>

            <div className="grid gap-3">
              <SummaryItem label="Última actualización" value={formatRelativeDate(ticket.updatedAt)} />
              <SummaryItem label="Adjuntos" value={attachments.length > 0 ? `${attachments.length} archivo(s)` : "Sin adjuntos"} />
              <SummaryItem label="Comentarios visibles" value={String(comments.length)} />
            </div>
          </div>

          {attachments.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[rgba(91,72,199,0.12)] bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1b1638]">{attachment.name}</p>
                    <p className="text-sm text-[#5a5d7f]">
                      {attachment.kind} · {attachment.sizeLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f1edff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#5b48c7]">
                    Evidencia
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-[rgba(196,198,255,0.74)] bg-white p-6 text-[#1b1638] shadow-[0_24px_70px_rgba(6,4,20,0.18)] sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Conversación
              </p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#1b1638]">
                Comentarios del ticket.
              </h2>
              <p className="text-sm leading-6 text-[#5a5d7f]">
                Sumá contexto nuevo o respondé sobre el mismo caso sin salir del portal.
              </p>
            </div>

            <div className="grid gap-4">
              {comments.length > 0 ? (
                comments.map((comment) => {
                  const author = getUser(db, comment.authorId);
                  return (
                    <article
                      key={comment.id}
                      className="rounded-[24px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1b1638]">{author?.name ?? "N/D"}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-[#7b74a6]">
                            {comment.visibility === "internal" ? "Nota interna" : "Comentario visible"}
                          </p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b74a6]">
                          {formatRelativeDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-[#4f5378]">{comment.body}</p>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-[rgba(91,72,199,0.14)] bg-[#faf9ff] px-5 py-6 text-sm text-[#5a5d7f]">
                  Todavía no hay comentarios visibles en este ticket.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-[26px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
              <AddCommentForm
                actor={actor}
                ticketId={ticket.id}
                returnPath={`/portal/tickets/${ticket.id}`}
                allowInternal={canManageOperations(actor.role)}
                tone="light"
              />
            </div>
          </section>

          <section className="rounded-[32px] border border-[rgba(196,198,255,0.74)] bg-[linear-gradient(180deg,rgba(249,248,255,0.97),rgba(239,236,255,0.94))] p-6 text-[#1b1638] shadow-[0_24px_70px_rgba(6,4,20,0.18)] sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b48c7]">
                Historial
              </p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#1b1638]">
                Trazabilidad del caso.
              </h2>
              <p className="text-sm leading-6 text-[#5a5d7f]">
                Cambios de estado, prioridad y actividad reciente del ticket.
              </p>
            </div>

            <div className="grid gap-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[22px] border border-[rgba(91,72,199,0.12)] bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#1b1638]">{entry.message}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b74a6]">
                      {formatRelativeDate(entry.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[rgba(91,72,199,0.12)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b74a6]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#1b1638]">{value}</p>
    </div>
  );
}
