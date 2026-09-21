> HISTORICAL / SUPERSEDED: the direct backend worker described here was removed by the n8n reconciliation. See `2026-09-17_radar-n8n-reconciliation.md`. Do not activate the old runtime.

# Radar API pilot — activation and recovery

## Existing deployment and limits
GitHub verified sdnexops serves portal.nexopstech.com, repository nexopsticketera/main. Authenticated Vercel settings confirmed project prj_XZ78r6Rwyu8TT6khC3LO1U3sm2Wa, Fluid enabled, Hobby, iad1. Current official Fluid limit: 300 seconds. Operation pages explicitly export maxDuration=300; durable deadline 240 seconds; worker ends 15 seconds before deadline and each provider request times out at 45 seconds. Next `after` uses the deployment lifetime after response; it does not depend on the browser remaining open. A killed process is marked FAILED by expiry on view/start or existing authorized cron maintenance. No automatic API retries.

## Safe pilot configuration
Use ONLY sdnexops Preview branch `codex/radar-api-mvp`. OPENAI_API_KEY is Secret and server-only. Never read it back, copy it to files, logs, API payloads, Git or chat. Existing callback secret may sign private previews. No new key is created by this code.

- RADAR_API_ENABLED=false until schema, auth and previews verified; then true for authorized smoke.
- RADAR_OPENAI_MODEL=gpt-5-mini (only permitted model; standard service tier).
- RADAR_API_PILOT_MAX_RUNS=3.
- RADAR_API_PILOT_WORKSPACE_ID=nexops-api-pilot.
- RADAR_PLATFORM_WORKSPACE_ID=nexops-api-pilot.
- RADAR_CORPUS_WORKSPACE_ID=nexops.
- RADAR_PUBLICATIONS_URL=<web PR preview>/radar-publications.json (full corpus required).
- RADAR_WEB_PREVIEW_URL=<web PR preview>/radar/preview.
- RADAR_PUBLICATION_ENABLED=false; RADAR_SCHEDULER_ENABLED=false.

Create only an internal workspace row in existing Supabase by copying NexOps preferences; do not copy runs/decisions. company_id remains null and existing platform access policy applies. Existing #4/#5 and #73 remain historical and untouched. Additive migration must precede enabling API. Rollback: disable API on preview; preserve schema and historical evidence; no fallback to private queue.

## Spending policy
Alan authorized USD5 total pilot via companion setup task. Database reserves USD1.50 per run atomically with a lifetime USD5 maximum, and never refunds uncertain/failed/canceled requests. Three reservations use USD4.50 maximum reserved; reservation is NOT claimed invoice cost. Maximum 4 requests/run, 2 hosted tool calls/request, 4000 output tokens/request and 60000 UTF-8 bytes of supplied context/request. A FIX uses the additional writer + reviewer; a second FIX is rejection.

Conservative reservation calculation uses gpt-5-mini 400000-token context, at most 3 model passes per request with 2 tools, 4 requests, USD0.25/M input + USD2/M output + USD0.01/tool. Context upper allowance USD1.20 + output USD0.032 + 8 tools USD0.08 = USD1.312; USD1.50 reserved. Request forces standard service tier. Pricing or model changes require revalidation, never accept another model name silently. Measured token usage and estimatedUsd are recorded separately; invoice cost must be checked against provider usage. Ordinary two-call target <=USD0.20 must be validated by actual run, not asserted from simulations.

Official evidence checked 2026-09-15:
- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://vercel.com/docs/functions/configuring-functions/duration
- Installed Next 16.3.3 after documentation.

## Recovery
Cancellation fences all later writes. Failed research preserves last candidate/evidence; starting a new run is a new reserved use. Failed publication keeps exact edited composition and PNG digest; new human-confirmed retry uses a new attempt and cannot receive previous attempt callbacks. A recorded merge blocks republishing: verify that existing release first. No publication or historical cutover is performed merely by enabling this preview.
