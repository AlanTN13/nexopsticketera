import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";

export const RADAR_COVER_TYPES = ["editorial-diagram", "process-diagram", "data-flow", "operations-interface"] as const;
export type RadarCover = { pngBase64: string; sha256: string };
const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
function lines(value: string, width: number, count: number) {
  const output: string[] = [];
  for (const word of value.trim().split(/\s+/)) {
    if (!output.length || `${output.at(-1)} ${word}`.length > width) output.push(word);
    else output[output.length - 1] += ` ${word}`;
  }
  return output.slice(0, count).map((line, index) => index === count - 1 && output.length > count ? `${line}…` : line);
}
export function renderRadarCoverSvg(input: { title: string; topic: string; visualType: string; visualSubject?: string }) {
  if (!(RADAR_COVER_TYPES as readonly string[]).includes(input.visualType)) throw new Error("Plantilla de portada no válida.");
  const title = lines(input.title, 30, 5).map((line, index) => `<text x="100" y="${285 + index * 78}" font-size="60" font-weight="700">${escapeXml(line)}</text>`).join("");
  const subject = lines(input.visualSubject || input.topic, 29, 3).map((line, index) => `<text x="1050" y="${666 + index * 32}" font-size="23">${escapeXml(line)}</text>`).join("");
  const motifs: Record<string, string> = {
    "editorial-diagram": '<circle cx="1270" cy="405" r="135" fill="none" stroke="#c7baff" stroke-width="5"/><path d="M1140 405h260M1270 275v260" stroke="#9ef3d4" stroke-width="8"/><circle cx="1270" cy="405" r="60" fill="#157f76"/><rect x="1095" y="360" width="80" height="90" rx="16" fill="#9ef3d4"/><rect x="1365" y="360" width="80" height="90" rx="16" fill="#c7baff"/>',
    "process-diagram": '<path d="M1080 300h210v140h150v110" fill="none" stroke="#9ef3d4" stroke-width="10"/><rect x="1040" y="255" width="130" height="90" rx="16" fill="#c7baff"/><rect x="1225" y="395" width="130" height="90" rx="16" fill="#9ef3d4"/><rect x="1375" y="505" width="130" height="90" rx="16" fill="#c7baff"/>',
    "data-flow": '<path d="M1090 280v280M1090 350h185M1090 490h185M1275 350v140M1275 420h175" fill="none" stroke="#9ef3d4" stroke-width="12"/><circle cx="1090" cy="280" r="32" fill="#c7baff"/><circle cx="1090" cy="560" r="32" fill="#c7baff"/><circle cx="1275" cy="420" r="48" fill="#9ef3d4"/><rect x="1410" y="375" width="85" height="90" rx="18" fill="#c7baff"/>',
    "operations-interface": '<rect x="1030" y="250" width="470" height="340" rx="24" fill="#ffffff" fill-opacity=".09" stroke="#c7baff" stroke-width="4"/><path d="M1060 315h410" stroke="#c7baff" stroke-width="3"/><circle cx="1070" cy="285" r="8" fill="#9ef3d4"/><path d="M1070 380h150M1070 450h110M1070 520h180" stroke="#c7baff" stroke-width="16"/><path d="m1350 395 22 24 47-60m-69 116 22 24 47-60" stroke="#9ef3d4" stroke-width="12" fill="none"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#211245"/><path d="M980 0h620v900H980z" fill="#352061"/><g fill="#ffffff" font-family="Arial, Helvetica, sans-serif"><text x="100" y="110" font-size="27" letter-spacing="5" fill="#c7baff">RADAR BY NEXOPS</text><rect x="100" y="150" width="130" height="8" rx="4" fill="#9ef3d4"/>${title}${motifs[input.visualType]}${subject}<text x="100" y="800" font-size="28" fill="#c7baff">${escapeXml(input.topic.slice(0, 55))}</text></g></svg>`;
}
export async function renderRadarCover(input: Parameters<typeof renderRadarCoverSvg>[0]): Promise<RadarCover> {
  const png = await sharp(Buffer.from(renderRadarCoverSvg(input))).png({ compressionLevel: 9 }).toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.format !== "png" || metadata.width !== 1600 || metadata.height !== 900) throw new Error("La portada final no cumple PNG 1600 × 900.");
  return { pngBase64: png.toString("base64"), sha256: createHash("sha256").update(png).digest("hex") };
}
