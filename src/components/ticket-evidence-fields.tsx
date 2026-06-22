"use client";

import { useState } from "react";

import { MAX_TICKET_CONTEXT_URLS, MAX_TICKET_IMAGES } from "@/lib/ticketing";

export function TicketEvidenceFields({
  inputClassName,
  tone = "light",
}: {
  inputClassName: string;
  tone?: "dark" | "light";
}) {
  const [urlCount, setUrlCount] = useState(1);
  const [imageCount, setImageCount] = useState(1);

  const helperClass = tone === "light" ? "text-xs text-[#7b74a6]" : "text-xs text-[var(--muted)]";
  const buttonClass =
    tone === "light"
      ? "rounded-full border border-[rgba(17,24,39,0.08)] bg-white px-3 py-1.5 text-xs font-semibold text-[#4330a6] transition hover:border-[#7c5bff]"
      : "rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--brand-secondary)]";

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Agregar link</p>
            <p className={helperClass}>Podés sumar hasta {MAX_TICKET_CONTEXT_URLS} links.</p>
          </div>
          {urlCount < MAX_TICKET_CONTEXT_URLS ? (
            <button
              type="button"
              onClick={() => setUrlCount((current) => Math.min(MAX_TICKET_CONTEXT_URLS, current + 1))}
              className={buttonClass}
            >
              + Agregar link
            </button>
          ) : null}
        </div>
        {Array.from({ length: urlCount }, (_, index) => (
          <input
            key={`context-url-${index + 1}`}
            id={`contextUrl${index + 1}`}
            name={`contextUrl${index + 1}`}
            type="url"
            className={inputClassName}
            placeholder={`https://...`}
          />
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">Adjuntar imagen</p>
            <p className={helperClass}>Podés sumar hasta {MAX_TICKET_IMAGES} imágenes.</p>
          </div>
          {imageCount < MAX_TICKET_IMAGES ? (
            <button
              type="button"
              onClick={() => setImageCount((current) => Math.min(MAX_TICKET_IMAGES, current + 1))}
              className={buttonClass}
            >
              + Agregar imagen
            </button>
          ) : null}
        </div>
        {Array.from({ length: imageCount }, (_, index) => (
          <input
            key={`attachment-${index + 1}`}
            id={`attachment${index + 1}`}
            name={`attachment${index + 1}`}
            type="file"
            accept="image/*"
            className={`${inputClassName} file:mr-4 file:rounded-full file:border-0 file:bg-[#efeefe] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#4330a6]`}
          />
        ))}
      </div>
    </div>
  );
}
