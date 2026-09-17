import { describe, expect, it } from "vitest";
import { addImageSelection, clipboardFiles } from "@/lib/image-attachment-selection";
import { MAX_COMMENT_IMAGE_BYTES } from "@/lib/ticketing";

const png = (name = "captura.png", content = 1) => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, content])], name, { type: "image/png" });
const jpeg = () => new File([new Uint8Array([255, 216, 255, 1])], "captura.jpg", { type: "image/jpeg" });

for (const kind of ["ticket", "comment"] as const) {
  describe(`${kind} attachment selection`, () => {
    it("combines selector and pasted PNG/JPEG files with the same validation", async () => {
      const selected = await addImageSelection([], [png()], kind);
      const pasted = await addImageSelection(selected.images, [jpeg()], kind);
      expect(pasted.images.map(({ file }) => file.type)).toEqual(["image/png", "image/jpeg"]);
    });
    it("deduplicates by bytes despite different names/timestamps and within one batch", async () => {
      const selected = await addImageSelection([], [png(), png("otra.png")], kind);
      expect(selected.images).toHaveLength(1);
      expect(selected.duplicates).toBe(1);
      expect((await addImageSelection(selected.images, [png("pegada.png")], kind)).duplicates).toBe(1);
    });
    it("keeps different images with identical names and allows re-add after removal", async () => {
      const selected = await addImageSelection([], [png(), png("captura.png", 2)], kind);
      expect(selected.images).toHaveLength(2);
      expect((await addImageSelection(selected.images.slice(1), [png()], kind)).images).toHaveLength(2);
    });
    it("rejects excess without changing the existing list; duplicate at the limit is harmless", async () => {
      const selected = await addImageSelection([], [png("1.png", 1), png("2.png", 2), png("3.png", 3)], kind);
      await expect(addImageSelection(selected.images, [png("4.png", 4)], kind)).rejects.toThrow("hasta 3");
      expect(selected.images).toHaveLength(3);
      expect((await addImageSelection(selected.images, [png()], kind)).images).toHaveLength(3);
    });
    it("rejects oversize, unsupported MIME, misleading extensions and invalid signatures", async () => {
      const invalid = [
        new File([new Uint8Array(MAX_COMMENT_IMAGE_BYTES + 1)], "grande.png", { type: "image/png" }),
        new File(["text"], "nota.txt", { type: "text/plain" }),
        png("engaño.jpg"),
        new File(["not png"], "fake.png", { type: "image/png" }),
      ];
      for (const file of invalid) await expect(addImageSelection([], [file], kind)).rejects.toThrow();
    });
  });
}

describe("clipboard file extraction", () => {
  it("ignores text/HTML and empty clipboard", () => {
    expect(clipboardFiles(null)).toEqual([]);
    const items = [{ kind: "string", getAsFile: () => null }] as unknown as DataTransferItemList;
    expect(clipboardFiles({ files: [] as unknown as FileList, items })).toEqual([]);
  });
  it("uses files once even when items also supplies the same image", () => {
    const file = png();
    const data = { files: [file], items: [{ kind: "file", getAsFile: () => file }] } as unknown as DataTransfer;
    expect(clipboardFiles(data)).toEqual([file]);
    expect(clipboardFiles({ ...data, files: [] as unknown as FileList })).toEqual([file]);
  });
});
