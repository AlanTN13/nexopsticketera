"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addImageSelection, clipboardFiles, type AttachmentKind, type SelectedImage } from "@/lib/image-attachment-selection";
import { COMMENT_IMAGE_MIME_TYPES, MAX_COMMENT_IMAGE_BYTES, MAX_COMMENT_IMAGES, MAX_TICKET_IMAGES } from "@/lib/ticketing";

type PreviewImage = SelectedImage & { preview: string };

export function ImageAttachmentPicker({ kind, tone = "light" }: { kind: AttachmentKind; tone?: "light" | "dark" }) {
  const root = useRef<HTMLDivElement>(null);
  const current = useRef<PreviewImage[]>([]);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const processing = useRef(0);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { pending } = useFormStatus();
  const hintId = useId();
  const maxImages = kind === "ticket" ? MAX_TICKET_IMAGES : MAX_COMMENT_IMAGES;

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    const details = root.current?.closest("details");
    if (details) details.open = true;
    const version = generation.current;
    processing.current += 1;
    // Synchronous marker also guards submission before the next React render.
    root.current?.setAttribute("data-attachments-pending", "true");
    setBusy(true);
    queue.current = queue.current.then(async () => {
      if (version !== generation.current) return;
      try {
        const result = await addImageSelection(current.current, files, kind);
        if (version !== generation.current) return;
        const next = result.images.map((image) => current.current.find((item) => item.fingerprint === image.fingerprint)
          ?? { ...image, preview: URL.createObjectURL(image.file) });
        current.current = next;
        setImages(next);
        setError(null);
        setMessage(result.duplicates ? "Esa imagen ya está adjunta; no se agregó otra copia." : "Imagen agregada a los adjuntos.");
      } catch (caught) {
        if (version !== generation.current) return;
        setError(caught instanceof Error ? caught.message : "No pudimos agregar la imagen. Intentá nuevamente.");
        setMessage("");
      } finally {
        if (version === generation.current) {
          processing.current -= 1;
          if (!processing.current) {
            root.current?.removeAttribute("data-attachments-pending");
            setBusy(false);
          }
        }
      }
    });
  }, [kind]);

  useEffect(() => {
    const container = root.current;
    const form = container?.closest("form");
    if (!form) return;
    function paste(event: ClipboardEvent) {
      if (event.defaultPrevented || pending) return;
      const files = clipboardFiles(event.clipboardData);
      if (!files.length) return; // Text/HTML stays ordinary pasted text.
      event.preventDefault();
      addFiles(files);
    }
    function appendFiles(event: FormDataEvent) {
      current.current.forEach(({ file }, index) => {
        event.formData.append(kind === "ticket" ? `attachment${index + 1}` : "commentImages", file);
      });
    }
    function reset() {
      generation.current += 1;
      processing.current = 0;
      current.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
      current.current = [];
      container?.removeAttribute("data-attachments-pending");
      setImages([]);
      setBusy(false);
      setError(null);
      setMessage("");
    }
    form.addEventListener("paste", paste);
    form.addEventListener("formdata", appendFiles);
    form.addEventListener("reset", reset);
    return () => {
      form.removeEventListener("paste", paste);
      form.removeEventListener("formdata", appendFiles);
      form.removeEventListener("reset", reset);
    };
  }, [addFiles, kind, pending]);

  useEffect(() => () => {
    generation.current += 1;
    current.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
  }, []);

  function removeImage(fingerprint: string) {
    const image = current.current.find((item) => item.fingerprint === fingerprint);
    if (image) URL.revokeObjectURL(image.preview);
    current.current = current.current.filter((item) => item.fingerprint !== fingerprint);
    setImages(current.current);
    setError(null);
    setMessage("Imagen quitada.");
  }

  return <div ref={root} className="grid gap-2" aria-busy={busy}>
    <label className="relative inline-flex min-h-10 w-fit cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500">
      Adjuntar archivo
      <input className="sr-only" type="file" aria-label="Adjuntar archivo" aria-describedby={hintId} accept={COMMENT_IMAGE_MIME_TYPES.join(",")} multiple disabled={pending} onChange={(event) => {
        addFiles(Array.from(event.target.files ?? []));
        event.target.value = "";
      }} />
    </label>
    <div id={hintId} tabIndex={0} role="group" aria-label="Pegar imagen del portapapeles" className={`rounded-lg border border-dashed p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${tone === "light" ? "border-slate-300 text-slate-600" : "border-white/20 text-slate-300"}`}>
      <p>Pegá una imagen con Cmd+V / Ctrl+V acá o mientras escribís.</p>
      <p className="mt-1">Hasta {maxImages} imágenes JPG, PNG o WEBP · {MAX_COMMENT_IMAGE_BYTES / (1024 * 1024)} MB cada una.</p>
    </div>
    {images.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map(({ file, fingerprint, preview }) => <div key={fingerprint} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
      <img src={preview} alt={`Vista previa de ${file.name}`} className="aspect-video w-full rounded object-cover" />
      <p className="mt-1 truncate text-xs text-slate-700">{file.name}</p>
      <button type="button" disabled={busy || pending} onClick={() => removeImage(fingerprint)} aria-label={`Quitar ${file.name}`} className="min-h-10 text-xs font-semibold text-red-700 disabled:opacity-50">Quitar</button>
    </div>)}</div> : null}
    <p role="status" className={tone === "light" ? "text-xs text-slate-600" : "text-xs text-slate-300"}>{busy ? "Validando imágenes… Esperá antes de enviar." : message}</p>
    {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
  </div>;
}
