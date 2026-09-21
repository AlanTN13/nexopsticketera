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

Implementation started. Not merged, deployed or validated for this phase yet.

## Implementation and offline evidence

- Read-only admission from the existing private ledger blocks both search and manual source before request creation. Existing queued retries exclude only their own authorized queued row. The atomic USD 9 reserve guard is unchanged; its identified budget exception now terminalizes immediately.
- Revisión is the entry point; Publicadas, compact/filterable Historial and Configuración remain distinct. Old operation/opportunity/strategy URLs and run hash links are retained. No candidate/draft history is rendered wholesale on Revisión.
- Preparing is used until a persisted research phase; QA uses the persisted review/fix checkpoint. Negative results show their reason and no publishable score; eligibility requires affirmative ELIGIBLE and QA PASS. Manual input is secondary to its editorial result.
- Preview is available to the already-authorized operator; publication remains admin-only. Approval verifies the signed run/workspace/actor/composition receipt on the server. The decision RPC is service-role-only and preserves the existing actor/company permission function. The old authenticated decision RPC is revoked to prevent a direct bypass. Postponed pieces can return to a decision without bypassing gates.
- Independent review identified queued-retry, operator-preview, unknown eligibility and server-preview enforcement edges; each was corrected before promotion. Final review pending.
- Validation at 2026-09-21 23:45 UTC: 384 Vitest tests / 64 suites pass; typecheck and lint pass; local production Webpack build passes. n8n export verification passes unchanged. Backend tests include real PGlite permissions, stale admission/final reservation, unchanged ledger, retries, cancellation and company isolation. PGlite does not claim multi-session lock-timing coverage.
- Production baseline read: 15 NexOps runs; latest ca771204-3a50-4594-bc9f-ea143f8e0937 remains failed with its original historical timeout. Ledger is six reservations / USD 9; scheduler false; autonomy and publishing mode review. No historical result was promoted or refunded.

## Coordinated rollout and rollback

The migration is additive for data/schema but intentionally restricts the old decision RPC ACL. Deploy after checks/review, followed by the new server action. No pending eligible live article is approved during rollout. To roll back the code, also restore `GRANT EXECUTE ON FUNCTION public.decide_radar_run(uuid, uuid, text, text) TO authenticated` as an explicit rollback step; otherwise old approvals fail closed. No tables, ledger rows, reservations, credentials, scheduled jobs or provider settings are changed.

Not yet merged/deployed/visually verified for this phase. No live editorial run is authorized by this receipt.

### Final independent review correction

Approval now rebuilds the canonical persisted package, verifies that server-derived digest against the signed preview and passes the expected candidate into the locked decision RPC. A candidate changed concurrently cannot be approved. Pending/postponed preview uses the stored composition and cannot substitute edited client content; editing remains available after approval with a fresh exact-version publication preview. No article is published by these checks.
