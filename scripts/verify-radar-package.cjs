/* eslint-disable @typescript-eslint/no-require-imports -- Local cross-repository CommonJS loader harness. */
/* Cross-repository, local-only integration fixture. No API calls, publication or deploy. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const Module = require('node:module');
const portal = path.resolve(__dirname, '..');
const web = path.resolve(portal, '../web');
const ts = require(path.join(portal, 'node_modules/typescript'));
const oldResolve = Module._resolveFilename;
const oldLoad = Module._load;
Module._resolveFilename = function(request, ...rest) { return oldResolve.call(this, request.startsWith('@/') ? path.join(portal, 'src', request.slice(2)) : request, ...rest); };
Module._load = function(request, ...rest) { return request === 'server-only' ? {} : oldLoad.call(this, request, ...rest); };
require.extensions['.ts'] = function(module, filename) { module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename); };
async function main() {
  const { advanceRadarN8n, decideRadarN8n, editorialGates, sanitizeRadarResponse, RADAR_SCORE_CRITERIA } = require(path.join(portal, 'src/lib/radar-n8n-editorial.ts'));
  const vm = require('node:vm');
  const workflow = JSON.parse(fs.readFileSync(path.join(portal, 'n8n/radar-nexops.json'), 'utf8'));
  const code = workflow.nodes.find(node => node.name === 'Advance editorial').parameters.jsCode;
  async function runExport(state) {
    const sandbox = vm.createContext({ Buffer, TextDecoder, TextEncoder, require: id => { if (id !== 'crypto') throw new Error('Unexpected n8n Cloud import: '+id); return require('crypto'); }, $json: structuredClone(state) });
    // n8n Cloud 2.39.6 exposes Uint8Array without its TypedArray constructor
    // ancestry. The old WebIDL URL wrapper crashes before the engine can run.
    vm.runInContext('Object.setPrototypeOf(Uint8Array, Function.prototype)', sandbox);
    vm.runInContext('Object.defineProperty = (object) => object', sandbox);
    return (await vm.runInContext('(async()=>{'+code+'})()', sandbox))[0].json;
  }
  const { prepareRadarPublicationCandidate, buildRadarPublicationPackage, buildRadarPublicationBundle } = require(path.join(portal, 'src/lib/radar-publication.ts'));
  const { issueRadarPreviewToken } = require(path.join(portal, 'src/lib/radar-preview.ts'));
  const sources = [{ name: 'Documentación oficial simulada', url: 'https://vendor.example/release', evidence: 'La versión permite exportar datos desde septiembre de 2026.' }, { name: 'Contexto simulado', url: 'https://context.example/operations', evidence: 'El equipo valida la exportación antes de incorporarla a un reporte.' }];
  const claim = { text: 'La versión permite exportar datos.', sourceUrls: [sources[0].url] };
  const draft = { headline: 'Nueva exportación de datos para operaciones comerciales', deck: 'Datos simulados de prueba: una actualización orientada a reducir tareas manuales con controles de calidad.', bodyMarkdown: '## Datos simulados para integración\n\n' + 'La actualización permite exportar datos para la revisión del equipo. El responsable contrasta los resultados con la fuente antes de incorporarlos a sus informes de gestión. '.repeat(6) };
  const candidate = { title: draft.headline, topic: 'CRM & Ventas', sourceName: sources[0].name, sourceUrl: sources[0].url, score: 90, businessReasons: ['Reduce tareas manuales de seguimiento con revisión humana.'], draft };
  const outputs = [{ outcome: 'CANDIDATES', reason: 'Fuente simulada nueva.', candidates: [{ title: candidate.title, topic: candidate.topic, sourceName: candidate.sourceName, sourceUrl: candidate.sourceUrl, businessReasons: candidate.businessReasons, topicIdentity: 'simulated-export-september-2026' }] }, { outcome: 'CANDIDATE', reason: 'Prueba simulada', candidate, sources, claims: [claim], topicIdentity: 'simulated-export-september-2026' }, { verdict: 'PASS', reason: 'Las fuentes simuladas respaldan el claim de prueba.', sources, checkedClaims: [{ ...claim, supported: true }], duplicateMatch: null, criticalGates: { sources: true, facts: true, novelty: true, clientClaims: true, content: true }, criticalGateReasons: { sources: '', facts: '', novelty: '', clientClaims: '', content: '' }, rubric: Object.fromEntries(RADAR_SCORE_CRITERIA.map(key => [key, { level: 3, evidence: sources[0].evidence, sourceUrls: [sources[0].url] }])) }];
  let calls = 0;
  let state = { version: 1, runId: 'c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4', executionId: 'controlled-fixture', deadline: new Date(Date.now()+240000).toISOString(), context: { preferences: { topics: ['CRM & Ventas'] }, corpus: [], requestKind: 'opportunity_search', requestPayload: {}, requestedAt: '2026-09-15T12:00:00Z', model: 'gpt-5-mini' }, responses: [] };
  for (const output of outputs) {
    state = await runExport(state);
    assert.ok(state.request, `fixture call ${calls + 1}: ${JSON.stringify(state.error)}`);
    calls++;
    state.responses.push(sanitizeRadarResponse({ status: 'completed', id: `simulated-${calls}`, usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: 'web_search_call', status: 'completed', action: { type: 'search', sources } }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }));
  }
  state = await runExport(state);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), await advanceRadarN8n(JSON.parse(JSON.stringify(state))));
  const result = state.result;
  assert.equal(calls, 3); assert.equal(result.status, 'review_pending');
  const preparedCandidate = await prepareRadarPublicationCandidate(result.candidate);
  const run = { id: 'c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4', workspaceId: 'nexops', requestedBy: 'a40b81b7-6ac4-4da1-92e8-86a7a50f9dc4', requestKind: 'opportunity_search', autonomyMode: 'review', status: 'review_pending', createdAt: '2026-09-15T12:00:00Z', candidate: { ...result.candidate, ...preparedCandidate } };
  const composition = { ...preparedCandidate.composition, sourceVerified: true, rightsVerified: true, clientClaimsAuthorizedOrAbsent: true };
  let preview = await buildRadarPublicationPackage(run, composition);
  const { validateRadarN8nArtifact, validateRadarControlledEligibility } = await import(pathToFileURL(path.join(web, 'scripts/radar-n8n-preflight.mjs')));
  const preflight = validateRadarN8nArtifact(preview);
  assert.equal(preflight.valid, true, preflight.errors.join('; '));
  const gates = { ...editorialGates(state), cover: true, siteValidation: preflight.valid, budget: true, consistency: true };
  const eligibility = decideRadarN8n(state, gates);
  assert.equal(eligibility.outcome, 'AUTO_PUBLISH'); assert.equal(eligibility.score, 85);
  run.candidate.score = eligibility.score;
  preview = await buildRadarPublicationPackage(run, composition);
  assert.equal(validateRadarControlledEligibility({ ...preview, decision: eligibility, gates }).valid, true);
  assert.equal(validateRadarControlledEligibility({ ...preview, decision: eligibility, gates: { ...gates, cover: false } }).valid, false);

  process.env.RADAR_PREVIEW_SECRET = 'simulated-local-signing-key-not-a-real-secret';
  const previewToken = issueRadarPreviewToken({ runId: run.id, workspaceId: run.workspaceId, actorId: run.requestedBy, compositionDigest: preview.compositionDigest });
  const bundle = await buildRadarPublicationBundle({ run: { ...run, status: 'approved' }, composition, previewToken, approvedBy: run.requestedBy, approvedAt: '2026-09-15T12:05:00Z', callbackUrl: `https://portal.nexopstech.com/api/radar/runs/${run.id}/publication` });
  const { validateRadarDecision } = await import(pathToFileURL(path.join(web, 'scripts/radar-v3-core.mjs')));
  assert.deepEqual(validateRadarDecision(bundle.decision, bundle.article), []);
  const { runNewsDecision } = await import(pathToFileURL(path.join(web, 'scripts/news-run.mjs')));
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-package-integration-'));
  fs.writeFileSync(path.join(destination, 'decision.json'), JSON.stringify(bundle.decision));
  fs.writeFileSync(path.join(destination, 'article.json'), JSON.stringify(bundle.article));
  fs.writeFileSync(path.join(destination, 'cover.png'), Buffer.from(bundle.cover.pngBase64, 'base64'));
  fs.writeFileSync(path.join(destination, 'preview.json'), JSON.stringify(preview));
  const materialized = await runNewsDecision({ decisionPath: path.join(destination, 'decision.json'), newsDirectory: path.join(destination, 'news'), publicDirectory: path.join(destination, 'public') });
  assert.equal(materialized.files.length, 2);
  const article = JSON.parse(fs.readFileSync(materialized.files[0], 'utf8'));
  assert.deepEqual(article.sources, sources); assert.equal(article.topicFingerprint, result.candidate.topicFingerprint);
  console.log(JSON.stringify({ status: 'PASS', simulated: true, providerCalls: calls, sources: article.sources.length, materializedFiles: materialized.files.length, compositionDigest: bundle.compositionDigest, outcome: eligibility.outcome, eligibility: eligibility.eligibility, score: eligibility.score, gates, destination }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
