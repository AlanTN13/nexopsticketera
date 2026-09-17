"use client";

import { useActionState, useState } from "react";

import { addCommentAction, type AddCommentState } from "@/app/actions";
import { ActionStateForm, PendingSubmitButton } from "@/components/pending-form";
import { ImageAttachmentPicker } from "@/components/image-attachment-picker";

const initialState: AddCommentState = { error: null };

export function CommentForm({ actorId, ticketId, returnPath, visibility, label, submitLabel, tone }: {
  actorId: string; ticketId: string; returnPath: string; visibility: "external" | "internal";
  label: string; submitLabel: string; tone: "dark" | "light";
}) {
  const [state, action, pending] = useActionState(addCommentAction, initialState);
  const [body, setBody] = useState("");
  const inputClass = tone === "light"
    ? "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
    : "min-h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white";

  return <ActionStateForm action={action} pending={pending} className="grid gap-3">
    <input type="hidden" name="actorId" value={actorId} />
    <input type="hidden" name="ticketId" value={ticketId} />
    <input type="hidden" name="returnPath" value={returnPath} />
    <input type="hidden" name="visibility" value={visibility} />
    <label className="grid gap-2 text-sm" htmlFor={`body-${visibility}`}><span className="text-xs font-semibold text-slate-700">{label}</span>
      <textarea id={`body-${visibility}`} name="body" required rows={3} value={body} onChange={(event) => setBody(event.target.value)} className={inputClass} placeholder="Sumá contexto, respuesta o próximos pasos." />
    </label>
    <ImageAttachmentPicker kind="comment" tone={tone} />
    {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p> : null}
    <PendingSubmitButton
      idleLabel={submitLabel}
      pendingLabel="Enviando…"
      className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${visibility === "internal" ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-[#5b48c7] text-white"}`}
    />
  </ActionStateForm>;
}
