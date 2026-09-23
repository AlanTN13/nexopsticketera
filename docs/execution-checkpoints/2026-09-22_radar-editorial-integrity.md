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

Pending final CI, merge, production deployment and workflow publication evidence.
