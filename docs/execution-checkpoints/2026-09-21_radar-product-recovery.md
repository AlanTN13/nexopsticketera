# Radar product recovery — Phase A

## EXECUTION PREFLIGHT / DELIVERY DESIGN

- Owner: Director de Ejecución, Codex desktop in the existing project checkout. Sandbox workspace-write and approval review remain effective; no privilege expansion.
- Authorized result: the user-approved recovery of Radar in production, tracked by #56. Canon read at Alanos `3fcf2a38442ecb0ceab7a7e3dbd9cf131d753e10`: Execution_Runtime_Contract.md, NexOps_Radar_Recuperacion_Producto.md, NexOps_Content_Engine.md; #75 receipts read. Portal starts clean at `9ba81ca33601cb5f1794ccacf0ca8a9b8f1e1093`.
- T3 / L / R3: operational admission and authenticated actions plus product navigation. No architectural replacement. A1 extends the existing control plane and atomic reserve; A0 leaves a known misleading product, A2/new runtime is unnecessary and unauthorized.
- Budget: ZERO additional provider calls/reserves. Persistent six reservations / USD 9 remain unchanged. Scheduler and automatic publication stay OFF. No articles published, no credentials or other clients changed.
- Implementation partition: backend specialist owns admission RPC/read model and known claim-failure termination; owner integrates server actions and product UI/routes. Independent risk review after a concrete diff, before production.
- Invariants: authorization/company checks precede privileged reads/writes; preflight admission never substitutes the transactional last reserve; idempotent retries remain safe; a dispatched request is only preparing; rejected/ineligible results have no publishable score.
- Data: additive read-only service-role admission RPC if required; no new tables, queues or ledger modification. Existing run state and events remain authoritative. Configuration changes cannot activate scheduler/autopublish during this phase.
- Product: existing URLs remain valid; Review is daily entry, Published/History/Configuration separate. History compact with filters and details. Manual sources show editorial result first. Sources, QA and exact-version preview precede human decisions.
- Validation: targeted offline SQL/action/state/render tests, recorded provider replay, existing persisted records and historical preview; permission and tenant checks; full typecheck/lint/tests/build/CI; read-only production browser verification. No fresh research request.
- Rollout: reviewed migration then coordinated code deployment; old decisions fail closed during the transition. Code rollback also requires explicitly restoring the old authenticated decision RPC grant; new RPC stays service-role-only. No budget reset/refund and no stored run promotion during verification.
- Challenge pass: admission may race, so preserve the atomic last guard and terminalize only identified budget failures. Missing/unavailable admission fails closed. Configuration presence cannot assert worker health. Publication remains a separate exact-version gate.
- STOP: irreversible data change, new budget/provider call, real article publication, or unavoidable external authentication. No such action is needed to begin Phase A.

## Status

Core recovery merged in PR #83 at 9b8edae2f236bfd0a8d9da3f8aa791375f5b7767 and deployed to portal.nexopstech.com (dpl_CUt34XCNseHDdHPqVNraznYGG1Fr, READY, alias assigned). Final post-deploy closure is recorded in the Execution Receipt comments on PR #83 and issue #56. No new editorial run is authorized.

## Implementation and offline evidence

- Read-only admission from the existing private ledger blocks both search and manual source before request creation. Existing queued retries exclude only their own authorized queued row. The atomic USD 9 reserve guard is unchanged; its identified budget exception now terminalizes immediately.
- Revisión is the entry point; Publicadas, compact/filterable Historial and Configuración remain distinct. Old operation/opportunity/strategy URLs and run hash links are retained. No candidate/draft history is rendered wholesale on Revisión.
- Preparing is used until a persisted research phase; QA uses the persisted review/fix checkpoint. Negative results show their reason and no publishable score; eligibility requires affirmative ELIGIBLE and QA PASS. Manual input is secondary to its editorial result.
- Preview is available to the already-authorized operator; publication remains admin-only. Approval verifies the signed run/workspace/actor/composition receipt on the server. The decision RPC is service-role-only and preserves the existing actor/company permission function. The old authenticated decision RPC is revoked to prevent a direct bypass. Postponed pieces can return to a decision without bypassing gates.
- Independent review identified queued-retry, operator-preview, unknown eligibility and server-preview enforcement edges; each was corrected before promotion. Final independent R3 review approved 7ff4bd18a847a7e4a8e1c90cc2e30b79183fdd90 with no P1/P2 findings remaining.
- Validation at 2026-09-21 23:45 UTC: 384 Vitest tests / 64 suites pass; typecheck and lint pass; local production Webpack build passes. n8n export verification passes unchanged. Backend tests include real PGlite permissions, stale admission/final reservation, unchanged ledger, retries, cancellation and company isolation. PGlite does not claim multi-session lock-timing coverage.
- Production baseline read: 15 NexOps runs; latest ca771204-3a50-4594-bc9f-ea143f8e0937 remains failed with its original historical timeout. Ledger is six reservations / USD 9; scheduler false; autonomy and publishing mode review. No historical result was promoted or refunded.

## Coordinated rollout and rollback

The migration is additive for data/schema but intentionally restricts the old decision RPC ACL. Deploy after checks/review, followed by the new server action. No pending eligible live article is approved during rollout. To roll back the code, also restore `GRANT EXECUTE ON FUNCTION public.decide_radar_run(uuid, uuid, text, text) TO authenticated` as an explicit rollback step; otherwise old approvals fail closed. No tables, ledger rows, reservations, credentials, scheduled jobs or provider settings are changed.

Final CI on reviewed head: 388 tests / 64 suites, SQL regression, typecheck, lint, n8n export check and production build passed: https://github.com/AlanTN13/nexopsticketera/actions/runs/35669762165. No live editorial run is authorized by this receipt.

### Final independent review correction

Approval now rebuilds the canonical persisted package, verifies that server-derived digest against the signed preview and passes the expected candidate into the locked decision RPC. A candidate changed concurrently cannot be approved. Pending/postponed preview uses the stored composition and cannot substitute edited client content; editing remains available after approval with a fresh exact-version publication preview. No article is published by these checks.


## Production evidence and visual follow-up (2026-09-22 UTC)

- Migration file 20260921232941_radar_read_only_admission.sql applied as remote version 20260922000127. Live service-role read returns budget_exhausted, allowed=false, remainingRuns=0, reservedUsd=9. Both new functions deny anon/authenticated; service_role may execute. Old decision function also denies authenticated. Security advisor comparison produced no new findings.
- Production desktop: Revisión has no historical drafts/composers; Search and manual source inputs/submission are disabled before initiation. Historial has 15 compact records and no article until selected. Rejected/manual filter returns the one existing AIforce record with visible clientClaims reason, sources and original QA caveat, without publishable score. Existing Meta duplicate shows Sin oportunidad and its corpus reason. Config says scheduler/autopublish unavailable/OFF. Publicadas retains six existing verified entries; none created in this phase.
- Mobile navigation and keyboard Enter verified. Browser viewport override requested390×844; current browser zoom produced487 CSS-pixel width, document scrollWidth487 (no horizontal overflow). Four sections accessible; history has zero expanded articles by default. Original viewport restored. Old /operacion#run-UUID link resolves to selected Historial record.
- Offline replay of saved n8n31358 responses (run480e1520-51ec-453f-9b28-fd2eb2afb70e), current source, network forbidden: REJECT, INELIGIBLE, score=null, failedGates=[clientClaims], no next request, zero provider calls. Replay adjusts only local deadline; non-editorial gate booleans are harness inputs, not evidence of live validation. Sanitized result in ../execution-evidence/radar/2026-09-21-phase-a-replay.json.
- Visual verification found an unconditional publication warning above the preview button in the inherited composer. Automatic approval review blocked the preview click before execution. Follow-up clarifies that preview does not approve/publish; the publication warning sits next to the separate submit, only for publication-authorized/connected pieces. Preview remains type=button POST /preview; all permission/token/publication guards unchanged. The follow-up stays on the same recovery branch; no competing architecture or PR.
- Historical errors remain historical evidence (including original timeout); no result was rewritten/promoted. Full eligible live research→QA→preview→manual publication remains Phase B, pending separate authorization. No new secrets, ledger mutations, reservations, scheduler or autopublication changes.

### Preview route boundary correction

After the copy fix (#84, main5e61ab2, dpl_CKCi7ko6N1oN8UQ3Fo4es63RR2Q1 READY), a safe preview request generated the PNG but the web popup could not receive its package. Live HTTP headers proved /backoffice/radar/historial used COOP same-origin while the old /operacion alone allowed the preview popup. The approved route recovery had moved the compositor outside that exception.

The focused follow-up extends the existing COOP exception to the two Radar UI route trees only. AppShell/NavButton/PortalHomeCard enter Radar with document navigation; the visible Radar exit also loads a document, applying the target policy. Other modules keep their global same-origin header and ordinary client links. Exact popup identity/origin/nonce and server preview/publication gates remain unchanged. The pre-existing SPA logout may retain document COOP until the next document navigation; no auth rewrite or wider guarantee is claimed. Independent review approved without P1/P2; typecheck/lint and20 focused tests passed before CI. No provider call, reservation or article publication.
