# Radar NexOps — n8n runtime

This is the replacement runtime for PR #75, retaining the package/preview implementation in webneoxps#74. Do not run the superseded Next `after()` worker: it has been removed. `radar-api-provider.ts` is a reusable interpreter; its transport is mandatory, and Portal only supplies a network-free replay of responses. Only the native n8n HTTP Request node calls OpenAI.

## Workflow

`Private webhook → Claim run → Advance editorial → Needs OpenAI → Authorize request → OpenAI web search → Preserve safe response → Advance editorial`.

When no further request is due: `Prepare PNG and gates → Eligibility then score → Finish in Portal`.

The bounded cycle is research/draft → independent QA → at most one FIX → new QA. At most four provider requests, two search calls per request, 4,000 output tokens, 60,000 bytes supplied input. No automatic HTTP retries. Every call is authorized once against the existing durable reservation and execution ID. The original 240-second deadline, USD 1.50 reservation/run and USD 5 lifetime cap remain in force. A failed or ambiguous run does not refund its reservation.

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

No new OpenAI call was made in the reconciliation until the live workflow is installed, secured and invoked. Never report synthetic token fixtures as measured provider cost. Current prices were checked against OpenAI's [model](https://developers.openai.com/api/docs/models/gpt-5-mini) and [pricing](https://developers.openai.com/api/docs/pricing) documentation. `estimatedUsd` is derived from reported usage; it is not an invoice reconciliation.

n8n [Code node restrictions](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/) and [webhook authentication](https://docs.n8n.io/integrations/builtin/credentials/webhook/) were checked for the export.
