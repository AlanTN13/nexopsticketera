"use client";

import { useRef, useState } from "react";

import { MAX_TICKET_CONTEXT_URLS, MAX_TICKET_IMAGES } from "@/lib/ticketing";

export function TicketEvidenceFields({
  inputClassName,
  tone = "light",
}: {
  inputClassName: string;
  tone?: "dark" | "light";
}) {
  const [urlFieldIds, setUrlFieldIds] = useState([0]);
  const [imageFieldIds, setImageFieldIds] = useState([0]);
  const nextUrlFieldId = useRef(1);
  const nextImageFieldId = useRef(1);

  const helperClass = tone === "light" ? "text-xs text-[#7b74a6]" : "text-xs text-[var(--muted)]";
  const buttonClass =
    tone === "light"
      ? "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#4330a6] transition hover:border-[#7c5bff]"
      : "rounded-lg border border-[var(--border)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--brand-secondary)]";
  const removeButtonClass =
    tone === "light"
      ? "min-h-10 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      : "min-h-10 rounded-lg px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300";

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Agregar link</p>
            <p className={helperClass}>Podés sumar hasta {MAX_TICKET_CONTEXT_URLS} links.</p>
          </div>
          {urlFieldIds.length < MAX_TICKET_CONTEXT_URLS ? (
            <button
              type="button"
              onClick={() => {
                const fieldId = nextUrlFieldId.current;
                nextUrlFieldId.current += 1;
                setUrlFieldIds((current) => [...current, fieldId]);
              }}
              className={buttonClass}
            >
              + Agregar link
            </button>
          ) : null}
        </div>
        {urlFieldIds.map((fieldId, index) => (
          <div key={`context-url-${fieldId}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <input
              id={`contextUrl${index + 1}`}
              name={`contextUrl${index + 1}`}
              type="url"
              aria-label={`Link ${index + 1}`}
              className={inputClassName}
              placeholder="https://..."
            />
            {index > 0 ? (
              <button
                type="button"
                className={removeButtonClass}
                aria-label={`Quitar link ${index + 1}`}
                onClick={() => setUrlFieldIds((current) => current.filter((id) => id !== fieldId))}
              >
                Quitar
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-2 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Adjuntar imagen</p>
            <p className={helperClass}>Podés sumar hasta {MAX_TICKET_IMAGES} imágenes.</p>
          </div>
          {imageFieldIds.length < MAX_TICKET_IMAGES ? (
            <button
              type="button"
              onClick={() => {
                const fieldId = nextImageFieldId.current;
                nextImageFieldId.current += 1;
                setImageFieldIds((current) => [...current, fieldId]);
              }}
              className={buttonClass}
            >
              + Agregar imagen
            </button>
          ) : null}
        </div>
        {imageFieldIds.map((fieldId, index) => (
          <div key={`attachment-${fieldId}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <input
              id={`attachment${index + 1}`}
              name={`attachment${index + 1}`}
              type="file"
              accept="image/*"
              aria-label={`Imagen ${index + 1}`}
              className={`${inputClassName} file:mr-3 file:rounded-md file:border-0 file:bg-[#efeefe] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#4330a6]`}
            />
            {index > 0 ? (
              <button
                type="button"
                className={removeButtonClass}
                aria-label={`Quitar imagen ${index + 1}`}
                onClick={() => setImageFieldIds((current) => current.filter((id) => id !== fieldId))}
              >
                Quitar
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
