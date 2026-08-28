import { describe, expect, it } from "vitest";

import { validateCommentImages, validateTicketImages } from "@/lib/comment-image-validation";
import { MAX_COMMENT_IMAGE_BYTES } from "@/lib/ticketing";

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "captura.png", { type: "image/png" });

describe("comment image validation", () => {
  it("accepts up to three valid images", async () => {
    await expect(validateCommentImages([png(), png(), png()])).resolves.toBeUndefined();
  });

  it("rejects four images", async () => {
    await expect(validateCommentImages([png(), png(), png(), png()])).rejects.toThrow("hasta 3");
  });

  it("rejects oversized files", async () => {
    const file = new File([new Uint8Array(MAX_COMMENT_IMAGE_BYTES + 1)], "grande.png", { type: "image/png" });
    await expect(validateCommentImages([file])).rejects.toThrow("10 MB");
  });

  it("rejects active and mismatched formats", async () => {
    const svg = new File(["<svg></svg>"], "ataque.svg", { type: "image/svg+xml" });
    const mismatch = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "captura.jpg", { type: "image/png" });
    await expect(validateCommentImages([svg])).rejects.toThrow("JPG, PNG o WEBP");
    await expect(validateCommentImages([mismatch])).rejects.toThrow("extensión");
  });

  it("does not trust MIME without a matching signature", async () => {
    const fake = new File(["not an image"], "falsa.webp", { type: "image/webp" });
    await expect(validateCommentImages([fake])).rejects.toThrow("formato válido");
  });

  it("applies the same validation to initial ticket images", async () => {
    await expect(validateTicketImages([png(), png(), png()])).resolves.toBeUndefined();
    await expect(validateTicketImages([png(), png(), png(), png()])).rejects.toThrow("por ticket");
    const fake = new File(["not an image"], "falsa.png", { type: "image/png" });
    await expect(validateTicketImages([fake])).rejects.toThrow("formato válido");
  });
});
