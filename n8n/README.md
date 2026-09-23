# Radar NexOps — n8n runtime

This is the replacement runtime for PR #75, retaining the package/preview implementation in webneoxps#74. Do not run the superseded Next `after()` worker: it has been removed. `radar-api-provider.ts` is a reusable interpreter; its transport is mandatory, and Portal only supplies a network-free replay of responses. Only the native n8n HTTP Request node calls OpenAI.

## Editorial integrity correction (2026-09-22)

The generated workflow now runs a deterministic corpus prefilter before the first provider request whenever the request already contains a manual source. URL identity removes fragments and known tracking parameters, sorts the remaining query and normalizes only trailing slashes/default URL parsing; functional query parameters remain significant. Candidate URL/topic identity is checked again after research. An unequivocal match returns `NO_PUBLICATION`; uncertain similarity still goes through the established QA path.

QA cannot lower `novelty` on free text alone. It must return a stable corpus id/slug, matching corpus URL, exact title, optional exact fingerprint and a reason. Portal validates those fields against the same corpus supplied to QA. A missing or false reference is treated as an inconsistent QA/FIX response and cannot lower the novelty gate or create a PASS.

The server-side evidence ledger accumulates provider-attested search sources, completed page actions, safe HTTPS citations and an explicit manual source across the whole run. Writer, QA and the one FIX receive that ledger; validation accepts only URLs already present in it. Offline replays preserve n8n `31268` as a real Meta duplicate and advance n8n `31419` past its false duplicate while retaining the Microsoft Learn evidence from the first pass. No provider call is part of those regressions.

## Historical pilot extension: two validation runs (2026-09-21)

Alan explicitly authorized USD6 → USD9, preserving the existing four reservations / USD6. Migration `20260921202253_radar_pilot_nine_dollar_extension.sql`, backend gate <=9 and Production `RADAR_API_PILOT_MAX_RUNS=6` allow at most two additional USD1.50 reservations. No reset/refund or third run. Use the existing manual-note form with a fresh primary source absent from the corpus to reduce duplicate research; this uses the same n8n/QA/gates. Stop after success or two attempts; diagnose before requesting further budget. Scheduler/autopublishing OFF. The workflow bundle itself is unchanged.

## Structured output and prior USD6 extension (2026-09-21)

Writer and independent QA requests use Responses `text.format` with strict JSON schemas. Sources, claims and topic identity remain root fields; malformed/incomplete output still fails closed. This changes shape enforcement only, not factual validation or scoring. Reference: https://developers.openai.com/api/docs/guides/structured-outputs .

Alan authorized extending the existing pilot from USD5 to USD6 without refunding its USD4.50 historical reservations. Migration `20260921181608_radar_pilot_six_dollar_extension.sql`, callback budget gate and Production `RADAR_API_PILOT_MAX_RUNS=4` permit one additional USD1.50 reservation. Do not lower the cap below existing reservations, reset the ledger or assume another run is authorized. Scheduler and autopublishing remain OFF.

## Workflow

The export is compatible with the n8n Cloud task-runner sandbox: the URL adapter bundles the existing WHATWG parser directly as CommonJS, without WebIDL constructor inspection or runtime imports. The build exposes engine functions as ordinary data properties because the sandbox removes dynamically defined property descriptors. `radar-n8n-runtime.test.mjs` reproduces these restrictions; the cross-repository package fixture covers writer/QA, URL parsing, gates, PNG and publisher validation. Validate a changed bundle with synthetic data in the real Code node before spending another pilot reservation, and remove all fixtures before publishing.

`Private webhook → Claim run → Advance editorial → Needs OpenAI → Authorize request → OpenAI web search → Preserve safe response → Advance editorial`.

When no further request is due: `Prepare PNG and gates → Eligibility then score → Finish in Portal`.

The bounded cycle is research/draft → independent QA → at most one FIX → new QA. At most four provider requests, two search calls per request, 4,000 output tokens, 60,000 bytes supplied input. No automatic HTTP retries. Every call is authorized once against the existing durable reservation and execution ID. The original 240-second deadline and USD 1.50 reservation/run remain in force; the explicitly authorized lifetime cap is now USD 9. A failed or ambiguous run does not refund its reservation.

The workflow is exported inactive and has no scheduler node. Successful/error/manual execution persistence and progress persistence are disabled because webhook headers contain secrets. Never pin production execution data. Public run identity and safe sources, claims, usage, response IDs and outcomes remain in Supabase; no raw error bodies or reasoning are retained there.

## Existing state and controlled mode

No new tables, queues, services, tenant rules or publicator were created. `finish_radar_n8n_run` is an additive, service-role-only SECURITY INVOKER adapter around the existing completion RPC. It locks the run, verifies execution/revision, reuses dedupe and timeout handling, and atomically saves the receipt. A late timeout or final dedupe cannot leave a publicable score.

`AUTO_PUBLISH` is an **eligibility outcome in this controlled pilot**, not a claim that a production publication occurred. The run remains review_pending and says explicitly that production publishing is off. The existing publisher still requires its exact-package approval and real build/release gates. No fake human approval is created by n8n. Production autonomous dispatch is not enabled by this change.

Ineligible candidates have `decision.score=null`, `eligibility=INELIGIBLE`, and numeric candidate.score=0 for compatibility with the existing UI. Scoring is computed in n8n only after the critical gates, then recalculated by Portal to reject altered callbacks. The writer's suggested score is discarded. Bands reuse webneoxps/docs/content-engine-v1.md: opportunity 70, publication 85; server configuration overrides these defaults. Five evidence-based criteria earn 0/8/14/17/20 points. Exceptional components need two distinct consulted hosts; the normal strong case is 85, not 95. Host distinction is a conservative proxy, not proof of editorial independence; QA must establish independence.

The private preview, PNG, article contract and sources are preserved. Pure validators are generated from #74 with source hashes in `src/lib/radar-site-contract/provenance.json`. This runtime preflight checks the exact candidate contract and image. Full site tests/build remain mandatory before any actual publication, through the existing publisher. The controlled candidate build is separately recorded in the receipt; a runtime preflight is not a production build attestation.

## Secure installation on the existing instance

1. Import `radar-nexops.json` into `https://nexops.app.n8n.cloud` as a separate Radar workflow, leaving it unpublished until setup is complete. Do not edit other workflows.
2. Assign three credentials to the placeholder references:
   - **Radar private dispatch**: Header Auth, name `x-radar-dispatch-secret`, random secret >=32 characters. Match Portal `RADAR_N8N_DISPATCH_SECRET`.
   - **Radar Portal callback**: Header Auth, name `x-radar-callback-secret`, a distinct random secret >=32 characters. Match Portal `RADAR_N8N_CALLBACK_SECRET`.
   - **Radar OpenAI**: existing authorized OpenAI credential (`OpenAi account` was visible on the instance). Do not reveal or copy its key to workflow JSON. n8n's credential manager injects it into the native HTTP node.
3. Set the non-secret n8n variable `RADAR_PORTAL_ORIGIN` to the isolated Portal preview origin. Configure any Vercel preview protection credential through a credential manager as needed; do not remove deployment protection to make a callback pass.
4. Set server-only `RADAR_N8N_WEBHOOK_URL` to the workflow's production webhook URL and configure the two matching secrets in the Portal Preview branch. Keep all existing workspace/model/budget settings and `RADAR_PUBLICATION_ENABLED=false`, `RADAR_SCHEDULER_ENABLED=false`.
5. Apply the additive n8n completion migration before deployment. It was applied to the existing Ticketera project on 2026-09-17 (see receipt).
6. Publish **only this webhook workflow** (no cron), then invoke `Buscar ahora` with the existing administrator session and monitor the Portal result. Record n8n execution ID, Portal run ID, response IDs, measured input/output/search usage and resulting estimated USD.
7. Do not retry an ambiguous execution manually from n8n. The claim and issued-call fences intentionally reject that replay. Inspect the Portal state; a new user-triggered run is a new reservation.

No permission or credential values belong in Git/chat. Enter new credentials through secure managers; UI credential entry may require user handoff under browser security rules.

## Generate and verify

- `npm run radar:n8n:build`: reproducible export, crypto is the only external module required in n8n Cloud. The WHATWG URL parser is bundled because Cloud does not expose Node's URL module.
- `npm run radar:n8n:check`: CI rejects stale exports.
- `node scripts/build-radar-n8n.cjs --sync-site-contract`: synchronize pure validators from the sibling webneoxps checkout, retaining provenance.
- `npm test` and `npm run test:radar-db`: protocol, authorization, bounds, source evidence, four outcomes, gates and real SQL regression.
- With sibling #74 present: `node scripts/verify-radar-package.cjs` runs the actual exported Code node in a restricted JS sandbox, verifies replay parity, computes controlled AUTO_PUBLISH eligibility, renders PNG/private preview and materializes the exact package through the existing site pipeline. Provider data and approvals in this harness are explicit fixtures, never live evidence.

## Cost evidence and remaining live gate

A pre-existing direct-worker run `fb783cc0-29cc-4f69-b64d-cdc723de1b66` (2026-09-15) is FAILED due to invalid editorial JSON. Supabase recorded 12,582 input tokens, 1,797 output tokens, one web search, estimated USD 0.0167395 and USD 1.50 reserved. This corrects the old PR description claiming zero historical consumption. It does **not** validate n8n.

On 2026-09-21, production run `4260e34c-41b9-4b99-882f-9c297193cf53` / n8n `31268` completed as NO_PUBLICATION because its primary source was already published. Strict writer JSON, callback and Supabase persistence passed: one call, 12,732 input / 2,006 output tokens, one web search, USD 0.017195 usage-derived estimate. The duplicate gate stopped before QA; no live cover/preview was produced. That cutoff had four reservations / USD 6. The later authorization above permits only two further runs, retaining that history. See the [current receipt](https://github.com/AlanTN13/nexopsticketera/pull/75#issuecomment-5765570193).

Never report synthetic token fixtures as measured provider cost. Prices were checked against OpenAI's [model](https://developers.openai.com/api/docs/models/gpt-5-mini) and [pricing](https://developers.openai.com/api/docs/pricing) documentation. `estimatedUsd` is derived from reported usage; it is not an invoice reconciliation. A live eligible opportunity reaching QA, package and preview remains the acceptance gate for Radar V1 with human review.

n8n [Code node restrictions](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/) and [webhook authentication](https://docs.n8n.io/integrations/builtin/credentials/webhook/) were checked for the export.
