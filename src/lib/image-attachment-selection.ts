import { validateCommentImages, validateTicketImages } from "@/lib/comment-image-validation";

export type AttachmentKind = "ticket" | "comment";
export type SelectedImage = { file: File; fingerprint: string };

// Read synchronously during paste: the browser protects DataTransfer afterwards.
export function clipboardFiles(data: Pick<DataTransfer, "files" | "items"> | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files);
  if (files.length) return files;
  return Array.from(data.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

export async function addImageSelection(current: SelectedImage[], incoming: File[], kind: AttachmentKind) {
  const validate = kind === "ticket" ? validateTicketImages : validateCommentImages;
  // Validate before reading whole files; use the exact server-side rules.
  await validate(incoming);
  const next = [...current];
  let duplicates = 0;
  for (const file of incoming) {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (next.some((image) => image.fingerprint === fingerprint)) {
      duplicates += 1;
    } else {
      next.push({ file, fingerprint });
    }
  }
  await validate(next.map(({ file }) => file));
  return { images: next, duplicates };
}
