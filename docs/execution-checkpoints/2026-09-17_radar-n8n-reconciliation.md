# EXECUTION RECEIPT — Radar reconciliation to n8n

Date: 2026-09-17. Status: **BLOCKED_EXTERNAL for live E2E; implementation and controlled verification completed.** Not an accepted end-to-end MVP yet.

## Result and preserved work

Work continued on the existing PR #75 branch starting at `cc008a1abe50f8f725b27046633d41120b5bb0ee` and companion #74 at `0c4f42c1bb65570e890dfbff7fb564da0cd53f8b`; both matched remote Git before changes. Alanos `origin/main` at `2544c6d` explicitly requires n8n and supersedes the backend/Vercel editorial worker.

- Portal server action dispatches only to a private n8n webhook; browser never receives the webhook URL or credentials. Removed the Next `after()` editorial worker and its default provider transport. There is no fallback to the old queue or direct OpenAI execution.
- Export `n8n/radar-nexops.json` contains the runtime: native authenticated HTTP OpenAI + web search, a bounded editorial loop, QA with one correction maximum, deterministic eligibility/scoring, and callbacks to the same Portal/Supabase state.
- Reused prompts, evidence extraction, sources, corpus, cancellation/deadline fences, atomic reservation, idempotency, model/usage bounds, PNG renderer, composition, private preview and publicator contracts.
- New callbacks verify a distinct secure header, workspace, execution ownership, monotonic response prefix and a compare-and-set revision. Each billable request can be authorized once. Callback input streams are capped at 1 MB. No provider HTTP retries.
- Writer scores are discarded. Critical failure produces INELIGIBLE, final score null and compatible candidate score 0. Existing bands (70 opportunity / 85 publication) come from webneoxps/docs/content-engine-v1.md and support configured overrides. 95+ requires exceptional evidence.
- `finish_radar_n8n_run` wraps the existing completion RPC in one transaction so final dedupe/timeout cannot retain a publicable score. Additive SECURITY INVOKER function only; no new tables, services, queues or tenant permissions.
- AUTO_PUBLISH is tested as **controlled eligibility**. It does not publish a production article, fabricate manual approval, or enable autonomous production dispatch. Existing publication gates remain mandatory. This limitation is explicit in the runtime receipt and Portal reason.

## Required closure matrix

| Requirement | Evidence / actual status |
|---|---|
| Exportable/documented n8n workflow | Implemented; reproducible export check in CI, setup in n8n/README.md |
| Portal → n8n → Portal | Complete callback protocol tested with persistence fixtures; exported Code node executed in a restricted JS sandbox. **Live instance workflow not installed/verified** |
| Real OpenAI run with measured cost | **No new n8n run.** Historical direct-worker failed run found in Supabase; see cost evidence below |
| NO_PUBLICATION | Passing controlled callback/protocol and interpreter tests; no live n8n outcome claimed |
| REJECT | Passing controlled tests, including every critical gate independently and exhausted FIX; score cannot remain publicable |
| READY_FOR_REVIEW | Passing controlled protocol at score 70 |
| Eligible AUTO_PUBLISH controlled | Passing controlled protocol at 85, exact exported JS, PNG/package validation and isolated full site build. No production publication |
| Cover/private preview | Real PNG 1600×900 and exact digest preserved; full source set validated/materialized through #74. Browser preview validation from this session is not claimed |
| Proportional tests/build | Portal 261 tests, lint/typecheck, PGlite actual SQL regression, export freshness. Portal webpack build PASS. Default Turbopack hit local OS port restriction. Web 62 news tests, 5 Radar tests, lint/build/audit/SEO PASS. Controlled fixture corpus: news validation/tests/build/SEO PASS with 19 articles |
| PR reconciliation | Update #75/#74 in place; historical direct-worker docs explicitly superseded. No competing new PR |
| Receipt + knowledge delta | This durable record and proposed delta below; Alanos canonical executive files unchanged |

## Cost and real infrastructure evidence

Read-only query against existing Supabase Ticketera project `tfonsiurhjmllqaknhgh` on 2026-09-17 found:

- Run `fb783cc0-29cc-4f69-b64d-cdc723de1b66`, created 2026-09-15T18:50:35.06212Z, status FAILED, phase research_response_received, reason: invalid editorial JSON.
- Response ID `resp_067a4ccef94f539d016aa9937d562887d1a0f88a58f8412135`.
- 1 provider call, 12,582 input tokens, 1,797 output tokens, 1 web search.
- Usage-derived estimated cost **USD 0.0167395**. This is not an invoice reconciliation and not n8n evidence.
- Lifetime budget ledger: 1 reserved run, USD 1.50 reserved. **Do not reset/refund this ledger.** Two remaining USD 1.50 reservations fit under the USD 5 cap. The earlier PR text saying all historical usage was zero is superseded by this observed evidence.
- Internal pilot settings remain enabled/review mode, scheduler false. Historical runs are preserved.
- Additive migration `20260917122641_radar_n8n_atomic_completion.sql` applied successfully through Supabase on 2026-09-17 after PGlite regression. Existing service-role table/RPC access was verified. New function grants exclude anon/authenticated.
- Supabase security advisors returned existing INFO no-policy private/server-owned tables and WARN authenticated SECURITY DEFINER routines elsewhere; the new n8n function is SECURITY INVOKER, service-role-only, and was not flagged. No unrelated policy changes were made. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

New provider spend in this reconciliation: **USD 0**. Synthetic test tokens are not counted as live cost.

## Remote verification of implementation commits

Verified through GitHub after pushing both existing PR branches on 2026-09-17:

- Portal `6ebd14fec509a9fab5dace301e19822eac82fe89`: [CI run 130](https://github.com/AlanTN13/nexopsticketera/actions/runs/35221959954) completed SUCCESS; both Vercel checks (`nexopsticketera`, `sdnexops`) SUCCESS.
- Web `66d98f2529bc555b8b5001d2184e20aeb0afac56`: [Content Engine Validation run 337](https://github.com/AlanTN13/webneoxps/actions/runs/35221960220) completed SUCCESS; Netlify deploy-preview and Vercel checks SUCCESS.
- Both PRs remain open, mergeable and draft. Deployment success verifies the build/deploy checks, not a live n8n execution or a browser acceptance test.

## External blocker and next executable step

Existing `https://nexops.app.n8n.cloud` was found from the GlobalTrip integration; the authenticated browser session and existing `OpenAi account` credential were visible. No key was read, created or exposed.

Import was attempted using the supported file chooser. Chrome returned `fileChooser.setFiles failed: Not allowed`; the native fallback also timed out. The file was **not successfully imported**, no publication or schedule was activated. Browser upload requires enabling “Allow access to file URLs” for the ChatGPT extension, or importing the already-generated JSON through the user's UI.

After restoring upload, bind the existing OpenAI credential and the two separate Header Auth credentials, match server-only Preview settings and set `RADAR_PORTAL_ORIGIN`; then publish the webhook-only workflow and invoke Buscar ahora. New secret entry through UI can require user handoff under browser credential rules. The workflow is concrete and reviewable; no architecture decision is pending. Do not claim the live E2E passed until its execution ID, Portal outcome and usage are recorded.

## How the work was performed

- Direction executed directly: remote Git/state audit, n8n adapter/export, gates/scoring, atomic completion, cross-repository validators, regression and receipt.
- No subagents were used. Single writer retained the tightly coupled state/export contract; independent processes ran the Portal and web verification suites in parallel.
- Challenge: compared exported n8n JS with Portal replay; exercised cancellation races, duplicate claims, repeated call authorization, malformed/oversized callbacks, critical gates and final SQL dedupe/timeout; verified controlled candidate through the separate web validator and full build.
- No independent human or agent review claimed. Remaining limitations are explicit; live n8n/Browser E2E is still required.

## KNOWLEDGE DELTA — proposed, not persisted to executive canon

1. #75 now removes the superseded direct backend editorial runtime and supplies the n8n workflow plus authenticated callback adapter. #74's PNG, exact package, private preview and sources remain reused.
2. Controlled outcomes/gates and exact artifact build are verified; production publication and cron remain off. AUTO_PUBLISH evidence means eligible controlled candidate, not a published article.
3. Prior “OpenAI real spend = 0” is stale: Supabase contains the 15/09 failed direct-worker run with USD 0.0167395 usage-derived estimate and USD 1.50 retained reservation.
4. Live n8n E2E remains BLOCKED_EXTERNAL on workflow import/secure binding. The strategic architecture is settled; no new business definition is needed.
5. Catch-up of Alanos should verify these branch commits/CI and absorb this delta only with the distinction between controlled proof and live E2E intact.
