/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const output = 'docs/evidence/clipboard-attachments';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const results = [];
  async function record(name, run) { await run(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  const previews = section => page.locator(`${section} img`);
  async function settled(section) { await page.locator(`${section} [aria-busy="true"]`).waitFor({ state: 'hidden' }); }
  async function paste(section, options = {}) {
    await page.locator(`${section} textarea`).evaluate((target, options) => {
      const data = new DataTransfer();
      if (options.text) data.setData('text/plain', options.text);
      else {
        const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 220;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = options.color || '#5b48c7'; ctx.fillRect(0, 0, 400, 220); ctx.fillStyle = 'white'; ctx.font = '24px sans-serif'; ctx.fillText('Captura de prueba · NexOps', 24, 100);
        const mime = options.mime || 'image/png';
        const raw = atob(canvas.toDataURL(mime).split(',')[1]);
        const bytes = options.size ? new Uint8Array(options.size) : Uint8Array.from(raw, char => char.charCodeAt(0));
        data.items.add(new File([bytes], options.name || (mime === 'image/jpeg' ? 'captura.jpg' : 'captura.png'), { type: mime }));
      }
      const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      window.lastPastePrevented = event.defaultPrevented;
    }, options);
    await settled(section);
  }
  await page.goto('http://127.0.0.1:4318');
  await page.getByRole('heading', { name: 'Crear ticket' }).waitFor();
  await record('PNG paste opens collapsed ticket attachments and renders preview', async () => {
    await paste('#ticket'); assert.equal(await previews('#ticket').count(), 1); assert.equal(await page.locator('#ticket details').getAttribute('open'), '');
    assert(await previews('#ticket').first().evaluate(img => img.complete && img.naturalWidth > 0));
  });
  await record('Rapid repeat paste does not duplicate bytes', async () => {
    await Promise.all([paste('#ticket', { name: 'renamed.png' }), paste('#ticket', { name: 'again.png' })]);
    assert.equal(await previews('#ticket').count(), 1);
  });
  await record('Native selector appends JPEG to same preview list', async () => {
    const bytes = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 100; c.height = 100; return Array.from(atob(c.toDataURL('image/jpeg').split(',')[1]), ch => ch.charCodeAt(0)); });
    const input = page.locator('#ticket input[type=file]');
    await input.setInputFiles({ name: 'archivo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) }); await settled('#ticket');
    assert.equal(await previews('#ticket').count(), 2);
  });
  await record('Existing count limit blocks fourth image without clearing accepted files', async () => {
    await paste('#ticket', { color: '#0284c7' }); await paste('#ticket', { color: '#ef4444' });
    assert.equal(await previews('#ticket').count(), 3); assert.match(await page.locator('#ticket [role=alert]').innerText(), /hasta 3/);
  });
  await record('Oversize and invalid MIME show existing validation errors', async () => {
    await paste('#comment', { size: 10 * 1024 * 1024 + 1 }); assert.match(await page.locator('#comment [role=alert]').innerText(), /10 MB/);
    await paste('#comment', { mime: 'text/plain', name: 'nota.txt' }); assert.match(await page.locator('#comment [role=alert]').innerText(), /JPG, PNG o WEBP/);
    assert.equal(await previews('#comment').count(), 0);
  });
  await record('Text paste is not cancelled and creates no attachment', async () => {
    await paste('#comment', { text: 'Texto normal' }); assert.equal(await page.evaluate(() => window.lastPastePrevented), false); assert.equal(await previews('#comment').count(), 0);
  });
  await record('Comment JPEG paste and form isolation', async () => {
    await paste('#comment', { mime: 'image/jpeg', color: '#16a34a' }); assert.equal(await previews('#comment').count(), 1); assert.equal(await previews('#ticket').count(), 3);
  });
  await record('Remove and re-paste restores image exactly once', async () => {
    await page.locator('#ticket button[aria-label="Quitar captura.png"]').first().click(); await paste('#ticket'); assert.equal(await previews('#ticket').count(), 3);
  });
  await page.locator('#ticket').screenshot({ path: `${output}/desktop-ticket.png` });
  await page.locator('#comment').screenshot({ path: `${output}/desktop-comment.png` });
  await record('Mobile 390px preserves selector and previews without overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.locator('#ticket input[type=file]').isEnabled());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#ticket').screenshot({ path: `${output}/mobile-ticket.png` });
    await page.setViewportSize({ width: 1280, height: 1000 });
  });
  await record('React ticket action receives attachment1..3 with bytes; reset clears previews and next submission', async () => {
    await page.getByRole('button', { name: 'Crear ticket', exact: true }).click();
    await page.waitForFunction(() => window.submissions.length === 1);
    const files = (await page.evaluate(() => window.submissions[0])).filter(([key]) => key.startsWith('attachment'));
    assert.deepEqual(files.map(([key]) => key), ['attachment1', 'attachment2', 'attachment3']); assert(files.every(([, file]) => file.bytes.length > 0));
    await page.waitForFunction(() => document.querySelectorAll('#ticket img').length === 0);
    await page.getByRole('button', { name: 'Crear ticket', exact: true }).click(); await page.waitForFunction(() => window.submissions.length === 2);
    assert.deepEqual(await page.evaluate(() => window.submissions[1].filter(([key]) => key.startsWith('attachment'))), []);
  });
  await record('React comment action receives commentImages; reset starts a clean edit', async () => {
    await page.locator('#comment textarea').fill('Respuesta de prueba'); await page.getByRole('button', { name: 'Publicar respuesta' }).click(); await page.waitForFunction(() => window.submissions.length === 3);
    const files = (await page.evaluate(() => window.submissions[2])).filter(([key]) => key === 'commentImages'); assert.equal(files.length, 1); assert.equal(files[0][1].type, 'image/jpeg');
    await page.waitForFunction(() => document.querySelectorAll('#comment img').length === 0);
  });
  await record('Submitting during validation is blocked without locking comment retry', async () => {
    await page.evaluate(() => { const digest = crypto.subtle.digest.bind(crypto.subtle); crypto.subtle.digest = async (...args) => { await new Promise(resolve => setTimeout(resolve, 500)); return digest(...args); }; });
    const adding = paste('#internal', { color: '#eab308' });
    await page.locator('#internal [data-attachments-pending=true]').waitFor(); await page.getByRole('button', { name: 'Enviar alternativo' }).click();
    assert.equal(await page.evaluate(() => window.submissions.length), 3); await adding;
    await page.getByRole('button', { name: 'Enviar alternativo' }).click(); await page.waitForFunction(() => window.submissions.length === 4);
  });
  await record('Real browser clipboard PNG and keyboard paste reaches active form', async () => {
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 50; canvas.height = 50; canvas.getContext('2d').fillRect(0, 0, 50, 50);
      const blob = await new Promise(resolve => canvas.toBlob(resolve)); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    });
    await page.locator('#comment textarea').focus(); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
    await page.waitForFunction(() => document.querySelectorAll('#comment img').length === 1);
  });
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/browser-results.json`, JSON.stringify({ scope: 'Real React components and form actions with a local action stub; no hosted Auth/Storage', browser: await browser.version(), results, errors }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
