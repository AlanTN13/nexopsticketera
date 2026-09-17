/* eslint-disable @typescript-eslint/no-require-imports */
// QA component harness. Install esbuild/playwright separately; no production auth/data.
const { build } = require('esbuild');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const out = path.join(require('node:os').tmpdir(), 'nexops-clipboard-browser');
(async () => {
  mkdirSync(out, { recursive: true });
  await build({ entryPoints: ['tests/browser/clipboard-harness.tsx'], outfile: `${out}/bundle.js`, bundle: true, jsx: 'automatic', tsconfig: 'tsconfig.json', plugins: [{ name: 'mock-server-action', setup(build) {
    build.onResolve({ filter: /^@\/app\/actions$/ }, () => ({ path: 'actions', namespace: 'qa' }));
    build.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: 'export async function addCommentAction(_, data) { return window.capture(data); }', loader: 'js' }));
  }}] });
  const postcss = require('postcss');
  const tailwind = require('@tailwindcss/postcss');
  const css = await postcss([tailwind({ base: root })]).process('@import "tailwindcss";', { from: path.join(root, 'src/app/globals.css') });
  createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(`${out}/bundle.js`)); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-slate-50"><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  }).listen(4318, '127.0.0.1', () => console.log('Clipboard component QA: http://127.0.0.1:4318'));
})();
