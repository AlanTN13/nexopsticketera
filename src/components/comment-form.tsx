"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addCommentAction, type AddCommentState } from "@/app/actions";
import { COMMENT_IMAGE_MIME_TYPES, MAX_COMMENT_IMAGE_BYTES, MAX_COMMENT_IMAGES } from "@/lib/ticketing";

const initialState: AddCommentState = { error: null };

export function CommentForm({ actorId, ticketId, returnPath, visibility, label, submitLabel, tone }: {
  actorId: string; ticketId: string; returnPath: string; visibility: "external" | "internal";
  label: string; submitLabel: string; tone: "dark" | "light";
}) {
  const [state, action] = useActionState(addCommentAction, initialState);
  const [files, setFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputClass = tone === "light"
    ? "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
    : "min-h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white";

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    files.forEach(({ preview }) => URL.revokeObjectURL(preview));
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > MAX_COMMENT_IMAGES) {
      setLocalError(`Solo podés adjuntar hasta ${MAX_COMMENT_IMAGES} imágenes por mensaje.`);
      event.target.value = "";
      setFiles([]);
      return;
    }
    const invalid = selected.find((file) => !COMMENT_IMAGE_MIME_TYPES.includes(file.type as (typeof COMMENT_IMAGE_MIME_TYPES)[number]) || file.size > MAX_COMMENT_IMAGE_BYTES);
    if (invalid) {
      setLocalError("Revisá el formato y el tamaño: JPG, PNG o WEBP de hasta 10 MB.");
      event.target.value = "";
      setFiles([]);
      return;
    }
    setLocalError(null);
    setFiles(selected.map((file) => ({ file, preview: URL.createObjectURL(file) })));
  }

  function removeFile(index: number) {
    const next = files.filter((_, itemIndex) => itemIndex !== index);
    URL.revokeObjectURL(files[index].preview);
    setFiles(next);
    const transfer = new DataTransfer();
    next.forEach(({ file }) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  return <form action={action} className="grid gap-3">
    <input type="hidden" name="actorId" value={actorId} />
    <input type="hidden" name="ticketId" value={ticketId} />
    <input type="hidden" name="returnPath" value={returnPath} />
    <input type="hidden" name="visibility" value={visibility} />
    <label className="grid gap-2 text-sm" htmlFor={`body-${visibility}`}><span className="text-xs font-semibold text-slate-700">{label}</span>
      <textarea id={`body-${visibility}`} name="body" required rows={3} className={inputClass} placeholder="Sumá contexto, respuesta o próximos pasos." />
    </label>
    <div>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-violet-500">
        Adjuntar imágenes
        <input ref={inputRef} className="sr-only" type="file" name="commentImages" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={selectFiles} />
      </label>
      <p className="mt-1 text-xs text-slate-500">Hasta 3 imágenes JPG, PNG o WEBP · 10 MB cada una.</p>
    </div>
    {files.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{files.map(({ file, preview }, index) => <div key={`${file.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
      <img src={preview} alt={`Vista previa de ${file.name}`} className="aspect-video w-full rounded object-cover" />
      <p className="mt-1 truncate text-xs text-slate-700">{file.name}</p><button type="button" onClick={() => removeFile(index)} className="mt-1 text-xs font-semibold text-red-700">Quitar</button>
    </div>)}</div> : null}
    {localError || state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{localError ?? state.error}</p> : null}
    <SubmitButton label={submitLabel} internal={visibility === "internal"} />
  </form>;
}

function SubmitButton({ label, internal }: { label: string; internal: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${internal ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-[#5b48c7] text-white"}`}>{pending ? "Subiendo y publicando…" : label}</button>;
}
