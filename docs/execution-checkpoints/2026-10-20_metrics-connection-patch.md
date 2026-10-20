# Existing metrics dashboard — authenticated connection save

EXECUTION PREFLIGHT / PATCH MODE
- Result: associate an existing company's exact Meta Ads account and published shared CSV with its existing dashboard, as requested by Alan. No new dashboard/integration.
- Surface: remote GitHub branch and existing CI. No local implementation/runtime is claimed; the unrelated local legacy checkout is untouched. No trusted-pilot certification.
- Baseline: main f81464776ab95b0053c340ab28b92959b57e7410. Runtime contract c74478a3. S/T1/R2 application configuration path; real production configuration remains R3.
- Allowed delta: two fields in the existing administrator-only company products form, validation and session-bound persistence for those metrics settings.
- Frozen: Auth, RLS, triggers, grants, service-role writes, global sources, other companies, dashboard, external integrations and invitations.
- Existing controls stay authoritative. Direct SQL and normal Table Editor saves were denied/not persisted; this patch uses getSupabaseServerClient and the existing authenticated platform-admin check. No environment override or privileged bypass.
- Validation: CI lint/types/unit/regression/build; independent review of actor binding and target scope; production save/refresh/read only for Kenta after release gate.
- Rollback: revert application patch; restore only changed Kenta settings if necessary. Do not replay invitations.
- STOP: failed authorization stays failed; no guard removal or impersonation.

DELIVERY DESIGN / TEAM
- A1 minimal extension of the existing save action, reusing the server session and table policy.
- Director prepares one coherent change; focused independent review checks authorization, concurrency and preservation.
- Inputs absent/blank preserve configuration. Incomplete values and non-Google/credential-bearing sources are rejected before mutations.
- Read current raw settings after the existing product save; merge only accountName/metaSheetUrl, scope company+metrics, use updated_at as an optimistic lock. Preserve unrelated settings and company rows.
- No hardcoded tenant IDs, account names or shared source URLs in implementation.

Status: prepared for CI/review. No production release or save from this patch yet.
