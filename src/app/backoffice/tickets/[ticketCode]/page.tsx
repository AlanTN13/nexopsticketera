import { permanentRedirect, redirect } from "next/navigation";
import { AddCommentForm, LogoutClientForm, TicketWorkflowForm } from "@/components/forms";
import { AppShell, EmptyState, NavButton, PriorityPill, SectionCard, StatusPill, TimelineDate } from "@/components/ui";
import { getAppSnapshot, getVisibleTicketReference } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getInternalUsers, getTicketById, getTicketHistory, getUser, getVisibleComments } from "@/lib/queries";
import { ticketDetailPath, withActor } from "@/lib/routing";
import { formatRelativeDate, getTicketNextStep, translateHistoryMessage } from "@/lib/ticketing";
import { CommentAttachments } from "@/components/comment-attachments";
import { TicketContextLinks } from "@/components/ticket-context-links";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ ticketCode: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function BackofficeTicketDetail({ params, searchParams }: Props) {
  const [{ ticketCode }, { returnTo }] = await Promise.all([params, searchParams]);
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const visibleReference = await getVisibleTicketReference(ticketCode);
  const ticket = visibleReference ? getTicketById(db, actor, visibleReference.id) : null;
  if (!ticket) return <AppShell eyebrow="Backoffice" title="Ticket no encontrado" description="No pudimos ubicar el ticket." tone="light" navigation={[{ href: "/backoffice/queue", label: "Tickets", active: true }]}><EmptyState title="Nada para mostrar" detail="El ticket no existe o no está disponible." tone="light" /></AppShell>;

  const canonicalPath = ticketDetailPath("/backoffice", ticket);
  if (ticketCode !== ticket.code.toLocaleLowerCase("en-US")) permanentRedirect(canonicalPath);

  const comments = getVisibleComments(db, actor, ticket.id);
  const history = getTicketHistory(db, ticket.id);
  const assignee = getUser(db, ticket.assignedToId);
  const creator = getUser(db, ticket.createdById);
  const company = db.companies.find((item) => item.id === ticket.companyId);
  const internalUsers = getInternalUsers(db);
  const queueReturnPath =
    returnTo && (returnTo === "/backoffice/queue" || returnTo.startsWith("/backoffice/queue?"))
      ? returnTo
      : "/backoffice/queue";
  const actionReturnPath = returnTo
    ? `${canonicalPath}?returnTo=${encodeURIComponent(queueReturnPath)}`
    : canonicalPath;

  return <AppShell eyebrow="Backoffice · Ticket" title={`${ticket.code} · ${ticket.title}`} description="Gestión operativa y conversación del caso." tone="light"
    navigation={[{ href: queueReturnPath, label: "Tickets", active: true }, { href: withActor("/backoffice/companies", actor.id), label: "Empresas" }, { href: withActor("/backoffice/users", actor.id), label: "Usuarios" }, ...(actor.role === "platform_admin" ? [{ href: "/portal/radar", label: "Radar" }] : [])]}
    actions={<><NavButton href={queueReturnPath} label="Volver a tickets" muted tone="light" /><LogoutClientForm tone="light" /></>}
  >
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex flex-wrap items-center gap-2"><StatusPill status={ticket.status} /><PriorityPill priority={ticket.priority} /></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5"><Meta label="Empresa" value={company?.name ?? "Sin empresa"} /><Meta label="Solicitante" value={creator?.name ?? "Sin identificar"} /><Meta label="Responsable" value={assignee?.name ?? "Sin asignar"} /><Meta label="Actualizado" value={formatRelativeDate(ticket.updatedAt)} /><Meta label="Próximo paso" value={getTicketNextStep(ticket)} /></dl></section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-4">
        <SectionCard title="Conversación" description="Mensajes en orden cronológico. Las notas internas están claramente diferenciadas." tone="light">
          <div className="grid gap-2.5">{comments.map((comment) => { const author = getUser(db, comment.authorId); const internal = comment.visibility === "internal"; const images = db.attachments.filter((item) => item.commentId === comment.id); return <article key={comment.id} className={`rounded-lg border p-3 ${internal ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">{author?.name ?? "NexOps"}</p>{internal ? <p className="text-xs font-semibold text-amber-800">Nota interna</p> : null}</div><TimelineDate value={comment.createdAt} tone="light" /></div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{comment.body}</p><CommentAttachments attachments={images} /></article>; })}</div>
          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2"><div className="rounded-lg border border-slate-200 p-3"><AddCommentForm actor={actor} ticketId={ticket.id} returnPath={actionReturnPath} visibility="external" label="Responder al cliente" submitLabel="Enviar respuesta" tone="light" /></div><div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3"><AddCommentForm actor={actor} ticketId={ticket.id} returnPath={actionReturnPath} visibility="internal" label="Agregar nota interna" submitLabel="Guardar nota interna" tone="light" /></div></div>
        </SectionCard>
        <SectionCard title="Descripción y contexto" tone="light"><p className="whitespace-pre-line text-sm leading-6 text-slate-700">{ticket.description}</p>{ticket.contextUrls.length ? <div className="mt-3 border-t border-slate-200 pt-3"><p className="mb-2 text-sm font-semibold text-slate-800">Enlaces aportados por el cliente ({ticket.contextUrls.length})</p><TicketContextLinks urls={ticket.contextUrls} /></div> : null}</SectionCard>
        <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Historial ({history.length})</summary><div className="grid gap-2 border-t border-slate-200 p-3">{history.map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-sm text-slate-700"><p>{translateHistoryMessage(entry.message)}</p><TimelineDate value={entry.createdAt} tone="light" /></div>)}</div></details>
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start"><SectionCard title="Gestión operativa" description="Estado, prioridad y asignación." tone="light"><TicketWorkflowForm actor={actor} ticketId={ticket.id} assignedToId={ticket.assignedToId} status={ticket.status} priority={ticket.priority} internalAgents={internalUsers} returnPath={actionReturnPath} tone="light" /></SectionCard></div>
    </div>
  </AppShell>;
}
function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="mt-0.5 font-semibold text-slate-900">{value}</dd></div>; }
