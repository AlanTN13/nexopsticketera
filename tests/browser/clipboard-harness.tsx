import { StrictMode, useActionState } from "react";
import { createRoot } from "react-dom/client";
import { TicketEvidenceFields } from "@/components/ticket-evidence-fields";
import { CommentForm } from "@/components/comment-form";
import { ActionStateForm, PendingForm, PendingSubmitButton } from "@/components/pending-form";
import { ImageAttachmentPicker } from "@/components/image-attachment-picker";

async function capture(data: FormData) {
  const entries = await Promise.all(Array.from(data.entries()).map(async ([key, value]) => [key,
    value instanceof File ? { name: value.name, type: value.type, size: value.size, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) } : value]));
  (window as unknown as { submissions: unknown[] }).submissions.push(entries);
  return { error: null };
}
Object.assign(window, { submissions: [], capture });

function CommentActionHarness() {
  const [, action, pending] = useActionState(async (_state: null, data: FormData) => { await capture(data); return null; }, null);
  return <ActionStateForm action={action} pending={pending}><textarea aria-label="Comentario alternativo" name="body" defaultValue="Texto" /><ImageAttachmentPicker kind="comment" /><PendingSubmitButton idleLabel="Enviar alternativo" pendingLabel="Enviando" /></ActionStateForm>;
}

createRoot(document.getElementById("root")!).render(<StrictMode>
  <main className="mx-auto max-w-3xl space-y-8 p-4 text-slate-900">
    <h1 className="text-xl font-bold">QA local · Adjuntos de la ticketera</h1>
    <section id="ticket" className="rounded-xl border bg-white p-4"><h2 className="mb-4 text-lg font-semibold">Crear ticket</h2>
      <PendingForm action={capture} className="grid gap-3">
        <label>Descripción<textarea aria-label="Descripción" name="description" className="block w-full rounded border p-2" defaultValue="Captura del caso informado por Germán." /></label>
        <details><summary>Agregar archivos, imágenes o enlaces</summary><TicketEvidenceFields inputClassName="w-full rounded border p-2" /></details>
        <PendingSubmitButton idleLabel="Crear ticket" pendingLabel="Creando…" className="rounded bg-violet-700 p-3 text-white" />
      </PendingForm>
    </section>
    <section id="comment" className="rounded-xl border bg-white p-4"><h2 className="mb-4 text-lg font-semibold">Comentario</h2>
      <CommentForm actorId="qa" ticketId="qa" returnPath="/qa" visibility="external" label="Respuesta" submitLabel="Publicar respuesta" tone="light" />
    </section>
    <section id="internal"><CommentActionHarness /></section>
  </main>
</StrictMode>);
