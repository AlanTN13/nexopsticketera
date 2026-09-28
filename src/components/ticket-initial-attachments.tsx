import { AttachmentGallery } from "@/components/comment-attachments";
import type { TicketAttachment } from "@/lib/ticketing";

export function TicketInitialAttachments({
  attachments,
}: {
  attachments: TicketAttachment[];
}) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-sm font-semibold text-slate-800">
        Adjuntos iniciales ({attachments.length})
      </p>
      <AttachmentGallery attachments={attachments} />
    </div>
  );
}
