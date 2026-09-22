# Manual Radar admission correction

EXECUTION PREFLIGHT
- Rol y superficie real: Director de Ejecución; local repos + authorized GitHub/Supabase/Vercel tools. Workspace-write, managed auto-review, no broadened privileges.
- Resultado y autorización: Alan clarified “pero a vos, a mi no yo quiero probarlo”: remove the accidental product-wide single-agent-run block so he can test manually in production. No new agent/provider run authorized.
- Contexto verificado / rutas / revisión: AlanOS AGENTS/runtime contract and Content Engine at fe03d8b; Portal AGENTS/main fb9e888; live budget spent .18653225, hold0, lifetime quota1 consumed1. No concurrent Portal changes.
- Budget S-M-L-XL / tipo T0-T4 / riesgo R0-R3: S / T1 correction / R3 monetary admission, bounded to one migration and admission parser; independent review before production.
- Dentro y fuera de alcance: optional lifetime quota removed for manual use; existing USD5 cap, USD1.50 atomic hold, daily frequency, concurrency, permissions, scheduler OFF/autopub OFF intact. No editorial fixes, no agent-initiated API calls.
- Aceptación y validaciones proporcionales: migration preserves all ledger entries/counters; manual admission after consumed quota, daily/concurrency/money/idempotency still enforced; SQL + parser tests, CI build and real PostgreSQL concurrent reservation; read-only production admission and authenticated UI verification.
- Permisos de producción / recuperación: manual-use enablement explicitly requested; deploy through reviewed green PR, audited SQL migration. Re-lock if needed by restoring finite authorized_new_runs equal to current new_runs_reserved; never reset ledger or counters.
- STOP y señal de BUDGET_RISK: stop after manual controls available. No editorial investigation, no OpenAI call or publication. Escalate only if this cannot be confined to existing admission controls.

Design: nullable optional lifetime quota, retaining its counter and existing accounting. NULL means daily/concurrency/cost limits apply; not unlimited spending. Backend validates remainingRuns against configured daily max, not hardcoded1. No new identity or runtime: agent STOP remains an execution instruction and agent will not click a research button. Regression fixture covers transition and preserved controls; CI concurrency now uses final migration.
