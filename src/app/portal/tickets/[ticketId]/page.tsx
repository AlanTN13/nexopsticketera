import { redirect } from "next/navigation";
import { AddCommentForm, LogoutClientForm } from "@/components/forms";
import { AppShell, EmptyState, NavButton, PriorityPill, SectionCard, StatusPill, TimelineDate } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { getTicketById, getTicketHistory, getUser, getVisibleComments } from "@/lib/queries";
import { canCommentOnTickets, formatRelativeDate, getTicketNextStep, translateHistoryMessage } from "@/lib/ticketing";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ ticketId: string }> };

export default async function PortalTicketDetail({ params }: Props) {
  const { ticketId } = await params;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");
  const ticket = getTicketById(db, actor, ticketId);
  if (!ticket) return <AppShell eyebrow="Portal cliente" title="Ticket no encontrado" description="No pudimos mostrar este ticket." tone="light" navigation={[{ href: "/portal", label: "Tickets", active: true }]} actions={<NavButton href="/portal" label="Volver" muted tone="light" />}><EmptyState title="Sin acceso al ticket" detail="No existe o no pertenece a tu empresa." tone="light" /></AppShell>;

  const comments = getVisibleComments(db, actor, ticket.id);
  const history = getTicketHistory(db, ticket.id);
  const assignee = getUser(db, ticket.assignedToId);
  const attachments = db.attachments.filter((item) => item.ticketId === ticket.id);

  return <AppShell eyebrow="Portal cliente · Ticket" title={`${ticket.code} · ${ticket.title}`} description="Conversación y seguimiento del caso." tone="light"
    navigation={[{ href: "/portal", label: "Tickets", active: true }, { href: "/portal/users", label: "Usuarios" }]}
    actions={<><NavButton href="/portal" label="Volver a tickets" muted tone="light" /><LogoutClientForm tone="light" /></>}
  >
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2"><StatusPill status={ticket.status} /><PriorityPill priority={ticket.priority} /><span className="text-xs text-slate-600">Nivel de atención asignado por NexOps</span></div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4"><Meta label="Responsable" value={assignee?.name ?? "NexOps · por asignar"} /><Meta label="Última actualización" value={formatRelativeDate(ticket.updatedAt)} /><Meta label="Próximo paso" value={getTicketNextStep(ticket)} /><Meta label="Adjuntos" value={attachments.length ? `${attachments.length} archivo(s)` : "Sin adjuntos"} /></dl>
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <SectionCard title="Conversación" description="Los mensajes aparecen del más antiguo al más reciente." tone="light">
        <div className="grid gap-2.5">{comments.length ? comments.map((comment) => { const author = getUser(db, comment.authorId); return <article key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-950">{author?.name ?? "NexOps"}</p><TimelineDate value={comment.createdAt} tone="light" /></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{comment.body}</p></article>; }) : <EmptyState title="Todavía no hay mensajes" detail="Las respuestas del equipo aparecerán acá." tone="light" />}</div>
        <div className="mt-4 border-t border-slate-200 pt-4">{canCommentOnTickets(actor.role) ? <AddCommentForm actor={actor} ticketId={ticket.id} returnPath={`/portal/tickets/${ticket.id}`} label="Escribí un mensaje" submitLabel="Enviar mensaje" tone="light" /> : <EmptyState title="Sin permisos para comentar" detail="Podés seguir el ticket, pero no publicar mensajes." tone="light" />}</div>
      </SectionCard>
      <div className="grid content-start gap-3">
        <SectionCard title="Descripción" tone="light"><p className="whitespace-pre-line text-sm leading-6 text-slate-700">{ticket.description}</p>{ticket.contextUrls.length || attachments.length ? <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Archivos y enlaces ({ticket.contextUrls.length + attachments.length})</summary><div className="mt-2 grid gap-2">{ticket.contextUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="break-all text-sm text-violet-700 underline">{url}</a>)}{attachments.map((item) => <a key={item.id} href={item.url} className="text-sm text-violet-700 underline">{item.name}</a>)}</div></details> : null}</SectionCard>
        <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Historial ({history.length})</summary><div className="grid gap-2 border-t border-slate-200 p-3">{history.map((entry) => <div key={entry.id} className="text-sm text-slate-700"><p>{translateHistoryMessage(entry.message)}</p><TimelineDate value={entry.createdAt} tone="light" /></div>)}</div></details>
      </div>
    </div>
  </AppShell>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="mt-0.5 font-semibold text-slate-900">{value}</dd></div>; }
