import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import runtime from '../n8n/runtime-url.cjs';
const { URL: RuntimeURL } = runtime;

const addresses = [
  'https://example.com/a?utm_source=x&q=a+b&q=c&fbclid=y#fragment',
  'https://usuario:clave@example.com:443/a', 'https://[::1]/',
  'https://127.1/', 'https://0x7f000001/', 'https://2130706433/',
  'https://éjemplo.com/a%20b?%75tm_source=x&keep=%2B',
  'https://example.com\\@127.0.0.1/a', 'https://example.com./',
  'https://example.com/a?x=~&utm_source=a&utm_source=b',
  'http://localhost/', 'file:///etc/passwd', 'javascript:alert(1)',
];
test('n8n URL adapter preserves native parsing and normalization used by security and deduplication', () => {
  for (const input of addresses) {
    const expected = new URL(input), actual = new RuntimeURL(input);
    for (const key of ['protocol', 'hostname', 'username', 'password']) assert.equal(actual[key], expected[key], `${input}: ${key}`);
    for (const url of [expected, actual]) {
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/.test(key)) url.searchParams.delete(key);
    }
    assert.equal(actual.toString(), expected.toString(), input);
  }
});
test('malformed absolute URLs are rejected', () => {
  for (const input of ['not a url', '/relative', 'https://', 'https://[broken]/', 'https://example.com:99999/']) assert.throws(() => new RuntimeURL(input));
});

test('generated bundle prepares a request with Cloud prototype and descriptor restrictions', async () => {
  const workflow = JSON.parse(readFileSync(new URL('../n8n/radar-nexops.json', import.meta.url), 'utf8'));
  const code = workflow.nodes.find(node => node.name === 'Advance editorial').parameters.jsCode;
  const sandbox = vm.createContext({ Buffer, TextEncoder, TextDecoder, require: name => { assert.equal(name, 'crypto'); return crypto; }, $json: {
    version: 1, runId: 'synthetic', executionId: 'synthetic', deadline: new Date(Date.now() + 240000).toISOString(),
    context: { model: 'gpt-5-mini', preferences: { topics: ['IA aplicada'] }, corpus: [], requestKind: 'opportunity_search', requestPayload: {}, requestedAt: new Date().toISOString() }, responses: [],
  } });
  vm.runInContext('Object.setPrototypeOf(Uint8Array, Function.prototype); Object.defineProperty = object => object;', sandbox);
  const [item] = await vm.runInContext('(async()=>{' + code + '})()', sandbox);
  assert.equal(item.json.error, undefined);
  assert.equal(item.json.request.model, 'gpt-5-mini');
  assert.equal(item.json.request.store, false);
});
