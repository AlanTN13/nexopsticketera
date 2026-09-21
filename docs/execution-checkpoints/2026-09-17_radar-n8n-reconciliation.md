# EXECUTION RECEIPT — Radar reconciliation to n8n

## Revalidación viva — 2026-09-21 (estado actual)

**BLOCKED_EXTERNAL antes de Buscar ahora. No E2E cerrado ni Radar V1 productivo.** Este delta sustituye el diagnóstico de importación pendiente del receipt histórico que sigue debajo.

### EXECUTION PREFLIGHT / alcance de esta reanudación

- Rol/superficie: ejecución técnica y sincronización documental expresamente solicitadas por Alan, en la tarea desktop existente; cwd es el espejo local de “Rol estrategico”, no se afirma sesión trusted Alanos. Permisos efectivos: workspace-write, red restringida con revisión automática de escalaciones; no se modificaron. Las lecturas de infraestructura usan conectores/autenticaciones autorizadas.
- Contexto: Alanos `35a7dfa1896f2ac4cdbcbe135d7419a9cc731620`; leídos `Execution_Runtime_Contract.md`, `NexOps_Content_Engine.md`, `AGENTS.md`, `Ultimo_Sync.md`, `Cola_Ejecucion.md` y las políticas de ejecución/capacidad/receipt/sync pertinentes. Sólo este resultado fue retomado.
- Budget M / T2 / R2 para reconciliación del piloto; promoción productiva y cambios de secretos compartidos son gate R3, no alcanzado. A0: reutilizar PR #75/#74 y runtime n8n existente. Sin rediseño, nuevo servicio, migración ni cambios de permiso.
- Capacidad: un escritor; inspección estructurada de Git/CI/Supabase y UI sólo para configuración real de n8n/Portal. Sin subagentes en este diagnóstico bloqueado; revisión independiente obligatoria antes de una eventual promoción de riesgo R3. No repetir suites completas del mismo commit.
- Aceptación: corrida autorizada desde Buscar ahora, IDs/uso/costo/callback/paquete/preview reales antes de integrar. STOP ante credencial incorrecta, sesión ausente o denegación del proveedor. No gastar reservas para diagnosticar configuración ya inválida. Rollback: no hubo cambios de runtime productivo ni ledger.

### Evidencia actual obtenida

- Git remoto: Portal PR #75 permanece draft/open, head `3641c37a3e204490579f8e59e98b27c80fe00a29`; Web #74 draft/open, head `66d98f2529bc555b8b5001d2184e20aeb0afac56`. Ambos reportan mergeable=true; no es autorización de merge. `origin/main` real del Portal avanzó a `ac2e87e25fbe6db62b17f8038edfd910d78aa6a7` y Web a `4e6aad87c88720ab63c5b9c42b2f08ce0e00b042`; la integración contra esos estados no se ejecutó.
- GitHub sigue mostrando CI Portal run 131 y Web run 337 SUCCESS, además de sus checks de despliegue Preview. Es evidencia de esos commits, no una nueva corrida E2E ni de producción.
- n8n vivo: workflow `BRbvcSEHpTIMpw63`, “Radar NexOps — n8n controlled pilot”, **Published**. El canvas tiene los diez nodos y el ciclo esperado; Private webhook POST `radar-nexops-v1`, sin trigger de cron visible. Esto corrige el estado canónico anterior “no instalado”. No se certificó igualdad byte a byte del código exportado con la instancia.
- Private webhook usa Header Auth account 2, ID `3CkSedfe5fMljbdt`; su Name visible es `x-radar-dispatch-secret`. **Claim run usa esa misma credencial**, aunque el backend exige `x-radar-callback-secret`. Las credenciales de despacho y callback no están separadas correctamente.
- La ficha de dependencias de esa credencial confirma dos consumidores: Radar y “GlobalTrip - Courier aereo V1 - PREVIEW”. No se leyó/reveló su Value, no se editó ni se afirma que GlobalTrip esté funcionando o caído. No reutilizar ni modificar nuevamente esa credencial compartida para cerrar Radar.
- OpenAI web search tiene seleccionado `OpenAi account`, llama a `/v1/responses`, usa `$json.request`, timeout 45000 ms y redirects apagados. Selección de credencial no equivale a prueba de proveedor.
- Variables de n8n: la UI mostraba “Create your first variable”; se guardó `RADAR_PORTAL_ORIGIN` con `https://sdnexops-git-codex-rad-53fbac-alan-fernandezs-projects-f6e1f457.vercel.app`. La tabla confirmó la variable y muestra Scope Global. Es una URL no secreta, exclusiva de este piloto; no se habilitaron cron ni publicación. Reversión: retirar esa variable si se abandona la configuración del piloto.
- Portal Preview de la rama responde, pero navegar a `/backoffice/radar/operacion` redirige a `/portal/login?reason=session`. Falta una sesión administrativa real para Buscar ahora.
- Dos POST sin credenciales al endpoint n8n del Preview devolvieron HTTP 401 JSON; el segundo sólo discriminó el tipo de respuesta. No se enviaron secretos, no se disparó n8n/OpenAI y no se usó un run real. Esto es evidencia negativa de rechazo HTTP, no un callback autenticado exitoso.
- Vercel: la lectura autenticada actual de `/v9/projects/sdnexops` devolvió HTTP 403. Se detuvo esa vía sin rotar claves ni ampliar accesos. La existencia de tres variables Preview guardadas el 17/09 es histórica; no se afirma que su despliegue/valor efectivo esté verificado hoy.
- Supabase vivo: ledger `reserved_runs=1`, `reserved_usd=1.50`; workspaces `nexops` y `nexops-api-pilot` en review y scheduler=false. El único run del piloto sigue siendo `fb783cc0-29cc-4f69-b64d-cdc723de1b66`, fallido el 15/09, sin n8nExecutionId/receipt, candidato ni URL final. Usage histórico: una llamada, 12582/1797 tokens, una búsqueda, USD 0.0167395 estimados. No se modificó ni refundó el ledger.

### Gate y distinción de estados

Implementado: sí, en las dos PR existentes. Mergeado: no. Desplegado: Preview con checks exitosos; n8n publicado. Validado E2E vivo: no. Productivo Radar V1 con revisión humana: no. Autónomo: no; scheduler sigue apagado y no se habilitó autopublicación.

Intervención humana mínima en el gate seguro: disponer de credenciales Header Auth **separadas de GlobalTrip** para despacho y callback, asociadas a los valores existentes en el gestor seguro de Vercel (sin llevarlos a chat/Git/logs), y sesión administrativa en el Preview. La política de Computer Use requiere handoff para introducir/modificar credenciales. El acceso Vercel rechazado debe restablecerse por su vía autorizada antes de verificar configuración efectiva/redeploy. Después: asociar los nodos de callback, verificar configuración sin leer valores y ejecutar una sola corrida real. No merge ni activación autónoma mientras falte esa evidencia.

Los casos NO_PUBLICATION/REJECT/READY_FOR_REVIEW/AUTO_PUBLISH, hard gates, idempotencia y timeout/cancelación siguen sustentados por la evidencia **controlada** del mismo commit y CI; no se convierten en evidencia viva por esta inspección. Gasto OpenAI nuevo en esta reanudación: **USD 0**. No se ejecutó una nueva suite ni se generó una nueva portada/preview.

### KNOWLEDGE DELTA

El bloqueo de importación quedó superado: instancia real publicada y accesible. El gate real es configuración/autenticación y sesión, incluyendo una credencial compartida con GlobalTrip. El circuito completo, la producción y la autonomía permanecen sin graduar. Actualizar el hogar Radar y el corte incremental de Alanos, conservando STALE global por las divergencias ajenas a esta comprobación.

---

## Receipt histórico — 2026-09-17

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
