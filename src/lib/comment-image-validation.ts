import { COMMENT_IMAGE_MIME_TYPES, MAX_COMMENT_IMAGE_BYTES, MAX_COMMENT_IMAGES } from "@/lib/ticketing";

const signatures: Record<(typeof COMMENT_IMAGE_MIME_TYPES)[number], number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

const extensions: Record<(typeof COMMENT_IMAGE_MIME_TYPES)[number], string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export async function validateCommentImages(files: File[]) {
  if (files.length > MAX_COMMENT_IMAGES) throw new Error(`Solo podés adjuntar hasta ${MAX_COMMENT_IMAGES} imágenes por mensaje.`);
  for (const file of files) {
    if (!COMMENT_IMAGE_MIME_TYPES.includes(file.type as (typeof COMMENT_IMAGE_MIME_TYPES)[number])) {
      throw new Error("Solo se admiten imágenes JPG, PNG o WEBP.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!extensions[file.type as keyof typeof extensions]?.includes(extension)) {
      throw new Error("La extensión del archivo no coincide con su formato de imagen.");
    }
    if (file.size <= 0 || file.size > MAX_COMMENT_IMAGE_BYTES) {
      throw new Error("Cada imagen debe pesar como máximo 10 MB.");
    }
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const expected = signatures[file.type as keyof typeof signatures];
    if (!expected?.some((signature) => signature.every((value, index) => bytes[index] === value))) {
      throw new Error("Una imagen no tiene un formato válido.");
    }
    if (file.type === "image/webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") {
      throw new Error("Una imagen no tiene un formato válido.");
    }
  }
}
