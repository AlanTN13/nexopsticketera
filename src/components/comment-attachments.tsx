/* eslint-disable @next/next/no-img-element */
import type { TicketAttachment } from "@/lib/ticketing";

export function CommentAttachments({ attachments }: { attachments: TicketAttachment[] }) {
  if (!attachments.length) return null;
  return <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{attachments.map((attachment) => attachment.url === "#" ?
    <div key={attachment.id} className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 p-2 text-center text-xs text-slate-600">{attachment.name} ya no está disponible</div> :
    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" aria-label={`Abrir imagen ${attachment.name}`} className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
      <img src={attachment.url} alt={attachment.name} className="aspect-video h-full w-full object-cover" />
    </a>)}</div>;
}
