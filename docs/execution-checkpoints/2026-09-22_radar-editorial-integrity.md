# Radar V1 — editorial integrity correction

## Execution preflight

- Role / surface: Director de Ejecución; existing `nexopsticketera` backend and generated n8n workflow only. No frontend redesign, new service, queue, database or publisher.
- Authorized result: fix the two demonstrated defects from n8n `31419` before any further live search: deterministic duplicate admission/QA proof and run-wide evidence continuity. Preserve n8n `31268` as a true duplicate.
- Canon read: `Alan/01_Architecture/Execution_Runtime_Contract.md` and `Alan/02_ProyectosPropios/NexOps/Pendientes/NexOps_Content_Engine.md` at AlanOS `origin/main` `72c4886`; issue `nexopsticketera#56`; receipt `nexopsticketera#86` comment `5769964822`. Technical base: Portal `4bff04c`.
- Budget / type / risk: M / T3 / R3. Zero provider calls authorized for this correction. Scheduler and automatic publication remain off.
- In scope: interpreter, strict provider schemas/prompts, generated n8n export, offline stored-response replays, tests and production deployment after green checks.
- Out of scope: UI changes, thresholds, model, architecture, corpus publication, scheduler, autopublishing and a new live Radar run.
- Acceptance: `31268` remains `NO_PUBLICATION`; `31419` does not accept the false duplicate and retains first-pass evidence through FIX; invalid duplicate reference is inconsistent; functional URL queries do not collapse; hard gates/scoring stay fail closed; export/tests/typecheck/lint/build green.
- Permissions / recovery: GitHub, Vercel, public corpus and read-only Supabase evidence available. Workflow publication must update only `BRbvcSEHpTIMpw63`; no credentials are read or changed.
- STOP / BUDGET_RISK: do not invoke OpenAI or `Buscar ahora`. Stop after offline production verification and durable receipt.

## Execution receipt

### Result

- Implemented and merged in [PR #88](https://github.com/AlanTN13/nexopsticketera/pull/88), squash commit `b9bb8b9`.
- Portal production deployment `dpl_3PuUyB18rttMBsqcsrsaWNfHMFrJ` is READY and serves `https://portal.nexopstech.com`; the Radar operation route returned HTTP 200 after deployment.
- Workflow `BRbvcSEHpTIMpw63` was published as version `ce0c0b96-267c-4e7e-84da-d4cc1ebdb379`. Its live `Advance editorial` code is byte-for-byte equal to the merged export: 283,818 bytes and SHA-256 `2934653ac9c8ef3bf84e43d61bf58bb57c28d06d9f25d54710c0d0738569901e`.
- Existing credential assignments were preserved: `Radar — Dispatch`, `Radar — Callback` and `OpenAi account`. No secret was read or changed.
- No live Radar execution or OpenAI request was made. Scheduler and automatic publication remain off.

### Root cause and correction

Run n8n `31419` exposed two independent defects. QA could set `novelty=false` through free text without identifying a publication that existed in the supplied corpus, so a new Microsoft Power Platform source was treated as a duplicate. The FIX pass then validated evidence only against URLs repeated in its latest response, so it lost the valid Microsoft Learn evidence consulted during the first pass.

The correction adds a conservative deterministic duplicate prefilter using canonical HTTPS URLs and exact stable topic identity. URL normalization removes fragments, known tracking parameters and equivalent trailing slashes while preserving functional query parameters. QA duplicate decisions now require a structured corpus reference; Portal validates its id, URL, title/fingerprint and reason against the actual corpus. A missing or false reference is an inconsistent QA response and follows the existing one-FIX/fail-closed contract. A server-side evidence ledger now accumulates only provider-attested search/page evidence and explicit manual sources for the full run, and writer, QA and FIX receive that same set.

### Offline replay and regression evidence

- n8n `31268`: the Meta Business Agent URL still matches the real corpus entry `meta-business-agent-whatsapp-leads-ventas` and resolves to `NO_PUBLICATION`. The pre-provider variant with tracking, fragment and trailing slash stops at `prefilter_duplicate` with `usage.calls=0`.
- n8n `31419`: the Microsoft Power Platform URL is absent from the supplied corpus. QA's unreferenced duplicate claim is now marked `QA inconsistente`, cannot lower the novelty gate and proceeds through the single allowed FIX. The Microsoft Learn source from the first pass remains in the accumulated evidence ledger.
- A new source can advance; semantically distinct functional query parameters are not collapsed.
- An invalid `matchedPublication*` reference is rejected as inconsistent. A valid Meta reference is accepted. Remaining hard gates and scoring remain fail closed.
- Focused regression suite: 62 tests PASS. Full suite: 417 tests across 66 suites PASS. Typecheck, lint, n8n export check and package verification PASS.
- CI run `35800282808`, job `106988822531`, PASS. The ordinary Turbopack build could not bind an auxiliary port in the execution sandbox; the production-equivalent `next build --webpack` completed successfully, and the Vercel production build also completed successfully.

### State separation and next gate

- Implemented: yes.
- Merged: yes.
- Portal deployed: yes.
- n8n bundle published: yes.
- Editorial E2E validated live after this change: no; intentionally not executed.
- Radar V1 productively accepted with a new positive opportunity: no.
- Ready for one separately authorized live validation: yes.

The next allowed action is one controlled live run to validate a new opportunity through QA, gates, cover, preview and human review. This receipt does not authorize that run, the scheduler, automatic publication or content publication.
