import { afterAll, describe, expect, it } from "vitest";
import { buildSync } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const directory = mkdtempSync(path.join(tmpdir(), "radar-font-regression-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
describe("packaged Radar font in a fresh process", () => {
  it("renders distinct Latin glyphs without system font directories", () => {
    const config = path.join(directory, "fonts.conf");
    writeFileSync(config, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><cachedir>${directory}</cachedir></fontconfig>`);
    const renderer = readFileSync("src/lib/radar-cover.ts", "utf8").replace('import "server-only";', "");
    const entry = path.join(directory, "render.cjs");
    buildSync({ stdin: { contents: renderer + `
      (async () => {
        const hashes = [];
        for (const title of ["IIII", "WWWW", "Árbol, acción, revisión y ñ"]) {
          const cover = await renderRadarCover({title, topic:"Operación", visualType:"data-flow"});
          const bytes = Buffer.from(cover.pngBase64,"base64");
          const metadata = await sharp(bytes).metadata();
          if (metadata.width!==1600 || metadata.height!==900 || metadata.format!=="png") throw new Error("Invalid PNG");
          const titlePixels = await sharp(bytes).extract({left:100,top:240,width:780,height:410}).raw().toBuffer();
          hashes.push(createHash("sha256").update(titlePixels).digest("hex"));
        }
        console.log(JSON.stringify(hashes));
      })().catch(error=>{console.error(error);process.exit(1)});
    `, loader: "ts", resolveDir: process.cwd() }, bundle: true, packages: "external", platform: "node", format: "cjs", outfile: entry });
    const output = execFileSync(process.execPath, [entry], { cwd: process.cwd(), env: { ...process.env, NODE_PATH: path.join(process.cwd(), "node_modules"), FONTCONFIG_FILE: config, FONTCONFIG_PATH: directory }, encoding: "utf8", timeout: 20000 });
    const hashes = JSON.parse(output.trim());
    expect(new Set(hashes).size).toBe(3);
  });
});
