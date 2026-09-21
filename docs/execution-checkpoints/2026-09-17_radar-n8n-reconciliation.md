# EXECUTION RECEIPT — Radar reconciliation to n8n

## Diagnóstico y corrección antes de la segunda corrida — 2026-09-21

Primera de las dos corridas adicionales: Portal `db79020f-53ad-4751-89fa-f5cb118313c2`, n8n `31335`, 20:29:53–20:30:29 UTC. Fuente Salesforce AIforce15/09 ausente del corpus18. FAILED/INELIGIBLE, score=null: NO_WEB_EVIDENCE antes de QA. Callback ok persistido; una llamada, 13.265 input / 1.634 output / una acción web, USD0.01658425 estimados. Ledger5/USD7.50 conservado; queda exactamente una corrida autorizada, no hubo refund.

Defecto reproducible: el adaptador sólo reconocía action.sources/annotations; descartaba status/type/url de acciones OpenAI open_page/find_in_page. La documentación oficial permite esas acciones con URL propia, sin sources[]. El payload original de31335 ya no está disponible por retención OFF, por lo que esta es una hipótesis compatible con el fallo vivo, no una causa forense confirmada. Corregido preservando exclusivamente tipo permitido, status permitido y URL HTTPS segura; sólo una acción completed aporta evidencia consultada. Nunca se confía en URLs inventadas por el escritor. QA factual, gates, bandas, modelo y presupuesto permanecen iguales.

Validación:63 tests/4 suites, typecheck, lint, export freshness y build webpack PASS; revisión independiente sin bloqueantes. Fixture crossrepo controlado PASS con PNG1600×900/paquete/AUTO_PUBLISH85, sin proveedor ni publicación. Prueba aislada Cloud conserva URL completed/open_page y elimina pattern con providerCalls=0; nodo temporal retirado. Workflow publicado325702d6-d312-4e4a-9b05-1a9da32a58ca: diez nodos, tres bundles idénticos a Git, conexiones/settings/credenciales iguales, pinData vacío.

Siguiente prueba: después del deployment Portal READY, usar la última reserva con la misma fuente primaria nueva, pues el fallo previo fue técnico y nunca produjo una pieza publicada. Se ajusta la preflight anterior que proponía cambiar de fuente: no hay evidencia de duplicado para esta oportunidad; cambiar de tema no corrige el defecto de extracción. STOP después de esta corrida, cualquiera sea el outcome. Scheduler/autopublicación OFF.

## EXECUTION PREFLIGHT — dos corridas autorizadas / USD9, 2026-09-21

Alan rechaza USD15 y autoriza exclusivamente ampliar USD6→USD9 para un máximo de dos corridas buscando QA→gates→portada→preview→revisión humana vivos. Base Portal59e48c2, Alanos5d29e7a; contrato/hogar y ledger4/USD6 verificados. M/T2/R3: owner/implementador único y reviewer independiente de migración/presupuesto. Reutilizar RPC/ledger/credenciales/n8n y formulario Nueva nota (manual_note) existente; no cambiar prompts, bandas, gates ni publicador. Seleccionar fuente primaria fechada reciente ausente del corpus18 y tema diferente a Meta/WhatsApp; primera candidata Salesforce AIforce15/09, contexto empresarial acotado y contrastación obligatoria. Si hace falta segunda, diagnóstico previo y fuente/acontecimiento distinto. Validar SQL sin reset/refund, quinta/sexta reserva y séptima rechazada, gate backend, typecheck/lint/build. Cloud/export sin cambio si sólo cambia store server-side. Rollout: migración no destructiva y max_runs6 Production, deploy verificado antes de disparar. Recuperación: deshabilitar entrada/forward-fix conservando reservas, nunca bajar cap por debajo del ledger. STOP al lograr aceptación o consumir dos corridas; ninguna tercera autorizada. Scheduler/autopublicación OFF; no aprobar/publicar en nombre humano.

## EXECUTION RECEIPT + KNOWLEDGE DELTA — 2026-09-21, 18:30 UTC

**El camino vivo NO_PUBLICATION está validado. Radar V1 editorial completo con revisión humana todavía no está aceptado.** Continúa #75 y webneoxps#74 ya mergeadas, sin arquitectura ni PR competidora.

### Corrección y despliegue
- El 401 había quedado resuelto al corregir Name/Value de Radar — Callback; no queda acción humana de credenciales.
- El siguiente fallo era JSON editorial incompleto y campos fuera del contrato. Commit **08a0b9376640b53bd18138ed729ac0f210dadaee**, integrado en main, exige Responses text.format/json_schema estricto para escritor y QA. Conserva gpt-5-mini, web search, máximo una corrección, gates/scoring y publicador.
- CI [35638413133](https://github.com/AlanTN13/nexopsticketera/actions/runs/35638413133) SUCCESS. Production **dpl_CXGRryyUZBjfiYyvdZCG8cD6zgZd**, READY con ese commit; Portal recargado antes de la única prueba viva.
- Workflow **BRbvcSEHpTIMpw63**, Published **8d33575e-d87a-4f82-92a0-3e7e27e00098**. Export vivo cotejado: tres Code nodes idénticos a Git, diez nodos, conexiones y credenciales conservadas, pinData vacío, timeout240 y retención desactivada. Prueba sintética Cloud sin proveedor retirada antes de publicar.

### Autorización y presupuesto
Alan autorizó expresamente USD5 → USD6 y una sola reserva adicional de USD1.50, conservando el ledger histórico3/USD4.50. Migración 20260921181608_radar_pilot_six_dollar_extension.sql aplicada; CHECK/RPC/gate a6 y Production RADAR_API_PILOT_MAX_RUNS=4. Sin UPDATE/reset/refund del ledger. Estado final verificado: **4 reservas / USD6**; no hay autorización ni presupuesto reservado disponible para otra corrida. USD6 reservado no equivale a costo facturado.

### Evidencia viva
- Portal **4260e34c-41b9-4b99-882f-9c297193cf53**; n8n **31268**.
- 18:29:30.726947–18:30:03.134168UTC, disparada desde Buscar ahora en producción.
- **NO_PUBLICATION / INELIGIBLE / score=null**: «La fuente principal ya está publicada en el corpus vigente».
- OpenAI: **1 llamada**, **12.732 input / 2.006 output**, **1 web search**, **USD0.017195 estimados a partir del uso**, no factura. Response resp_0777283cbf2bd538016ab17790b9c887d29b1e5f6549385e1f.
- Writer devolvió JSON válido y campos raíz correctos. 28 fuentes consultadas preservadas. Fuente principal https://about.fb.com/news/2026/06/meta-business-agent/ coincide con el corpus publicado de https://www.nexopstech.com/noticias/meta-business-agent-whatsapp-leads-ventas (13/08/2026). No se confundió un run fallido con una publicación.
- Callback recibido y persistido: Supabase radar_runs.status=no_publication, api_context.n8nReceipt.ok=true, decision y api_usage coincidentes. Portal muestra el resultado.
- El gate de duplicados detuvo la pieza antes de QA. **No hay QA, portada ni preview vivos para esta corrida**, por diseño; no se forzó publicación ni score para obtenerlos.
- Supabase final: nexops y nexops-api-pilot autonomy_mode/publishingMode=review y scheduler_enabled=false. Scheduler y autopublicación OFF.

### Evidencia controlada
54 tests/4 suites PASS; typecheck, lint de archivos tocados, export freshness y build webpack PASS. Suite SQL original y ampliación PGlite PASS: ledger histórico intacto, cuarta reserva, quinta bloqueada, idempotencia/cancelación sin refund y ACLs conservadas. Revisión independiente sin bloqueantes.
Fixture crossrepo: writer/QA simulados, fuentes, PNG1600×900 y paquete/publicador válidos; elegibilidad AUTO_PUBLISH85 controlada, sin publicación. Digest 479dfa74ccbf6ed9d344afff9a886eeb1fa89c121723d13c7f8246b51e35c385. No convertir esas pruebas en evidencia editorial viva.

### Estados y próximo gate
Implementado **sí**; integrado/mergeado **sí**; desplegado **sí**; transporte y NO_PUBLICATION E2E vivo **sí**; E2E editorial QA→portada→preview **no**; Radar V1 productivo con revisión humana **no aceptado todavía**; autónomo **no**.
El defecto de formato quedó resuelto para el escritor vivo. QA estricto sigue validado sólo de forma controlada. Falta una oportunidad nueva que pase los gates y permita validar QA/paquete/preview vivos. La única corrida adicional autorizada ya se consumió; detenerse aquí, conservar reservas y no iniciar más llamadas sin autorización adicional. No quedan credenciales que Alan deba copiar ni pruebas manuales que deba operar.

Receipt PR: https://github.com/AlanTN13/nexopsticketera/pull/75#issuecomment-5765570193 . Los cortes inferiores se conservan como historia; este corte rige el estado actual.

## EXECUTION PREFLIGHT — extensión autorizada, 2026-09-21

Alan respondió «dale si» a ampliar el piloto deUSD5 aUSD6 conservando ledger3/USD4.50. Alcance: esquema JSON estricto escritor/QA en Responses existente, migración del CHECK/RPC/gate presupuesto a6, max_runs4, misma reserva1.50 y una sola corrida real tras pruebas. Modelo/credencial/runtimes/gates/scoring/publicador inalterados. M/T2/R3, owner/implementador único y reviewer independiente del presupuesto/schema. Base Portal ef52f6a, canon Alanos248a61a y contrato/hogar consultados. Challenge: prompt JSON no exige estructura; no reparar arbitrariamente salida ni añadir llamada. Pruebas de request/schema y fixture Cloud offline antes de proveedor; PGlite valida extensión sin refund, cuarta reserva y quinta rechazada. Recuperación: revertir código/workflow si falla; nunca reducir cap por debajo de reservas ni borrar ledger. STOP al consumir la cuarta reserva o cualquier fallo sin diagnóstico concreto. No cron/autopublicación.

## Corte previo — 2026-09-21, callback resuelto / gate editorial y presupuesto

**401 resuelto. Transporte productivo Portal → n8n → OpenAI → callback → Supabase demostrado. Radar V1 editorial NO aceptado: respuesta inválida, FAILED/INELIGIBLE y sin preview. BUDGET_RISK: no iniciar otra corrida.** Los cortes inferiores son históricos y quedan sustituidos para el estado actual.

### EXECUTION PREFLIGHT / alcance y recuperación

Continuación expresamente autorizada por Alan después de guardar la credencial. Canon Alanos releído en `501c5655fb25ac6746130ac4f3e46ef75a233666`: contrato de runtime y hogar Radar. M/T2/R3, misma arquitectura/PR75+PR74; un integrador y revisión independiente del callback y compatibilidad n8n. Sin nueva plataforma, cambios de gates, permisos, modelo, presupuesto ni publicador. Cambios limitados al adaptador/build del export existente y su regresión. Recuperación: revertir el commit/export de compatibilidad si hiciera falta; no restaurar la credencial defectuosa ni devolver reservas. STOP ante presupuesto insuficiente o respuesta inválida, sin reintentos ciegos.

### Evidencia viva

- Alan guardó `Radar — Callback` con Name exacto `x-radar-callback-secret` y el nuevo valor ya aplicado como Secret Production. Cuatro callbacks usan esa credencial; Dispatch sigue separado. Probe real de Claim run, ejecución n8n **31225**, devolvió HTTP400 Invalid run, después de autenticar y antes de DB/reserva/OpenAI. La copia temporal local del secreto fue eliminada; no se expuso ni cambió OpenAI. Se conserva el hotfix trim: no era la causa del 401.
- La primera corrida autorizada pasó Claim y reveló incompatibilidad del bundle con n8n Cloud 2.39.6: wrappers WebIDL inspeccionaban la ascendencia TypedArray no disponible, y los exports/interop esbuild dependían de Object.defineProperty que el sandbox elimina. Run **bb1947a9-0b9b-438b-a611-6356227151fd**, exec **31231**, terminó por timeout a17:29:24.535901UTC, sin OpenAI; reserva retenida. Corregidos ambos problemas usando el mismo parser WHATWG como CommonJS estático y funciones exportadas como propiedades ordinarias, sin imports nuevos en runtime ni validaciones URL más débiles.
- Workflow **BRbvcSEHpTIMpw63**, versión publicada **0195b5dc-8440-405b-b470-836a3949ca9c**. Export vivo posterior confirma igualdad exacta de los tres Code nodes con el export de este commit, diez nodos, conexiones/credenciales conservadas, pinData vacío; timeout240 y retención desactivada. No cron ni autopublicación. Synthetic harness retirado antes de publicar.
- Tras diagnóstico/corrección/prueba sintética, una nueva corrida desde Buscar ahora: Portal **d2ed8008-95f9-4604-9d98-576691e217c5**, n8n **31253**, 18:00:08.195439–18:00:58.575305UTC. Deployment Portal **dpl_FP2VB3qzv6o6ENgig7zzSTVJaoy5**, commit `e1a662e`, dominio `portal.nexopstech.com`. Logs productivos registran los cuatro POST callback del run; Supabase contiene `n8nReceipt.ok=true`, resultado final y usage. Esto demuestra retorno/persistencia, no aceptación editorial.
- OpenAI real: modelo `gpt-5-mini`, **1 llamada / 12.507 input / 2.127 output / 1 web search / USD0.01738075 estimados por uso** (no factura). Response `resp_0ac5c62600e9ccd3016ab170b14d3487d2a84d13e07c62bd1e`. Se preservan 24 fuentes consultadas, incluyendo Meta Newsroom `/news/2026/06/meta-business-agent/`, WhatsApp Help Center `1153795669452207` y transcript Meta Q2 2026 en Q4cdn. Consultadas no equivale a QA factual aprobado.
- Outcome **FAILED**, eligibility **INELIGIBLE**, score **null**, failedGates **consistency**. Provider marcó completed pero entregó 7.857 caracteres sin la última llave JSON. Diagnóstico offline: agregarla sólo para inspección revela además `sources/claims/topicIdentity` dentro de candidate, cuando el contrato los exige en raíz. No se reparó/aceptó artificialmente la respuesta ni se modificó el run. No llegó a QA; candidato, portada y preview vivos ausentes.
- Ledger confirmado **3 reservas / USD4.50** del límiteUSD5; quedanUSD0.50, insuficientes para otra reservaUSD1.50. Sin reset/refund ni nueva llamada. El gasto observado de esta corrida no reemplaza el ledger. Ambos workspaces siguen autonomy/publishingMode=review, scheduler=false.

### Evidencia controlada y validación proporcional

- 38 tests de runtime/n8n/store PASS; typecheck y lint de archivos tocados PASS; export freshness y diff check PASS.
- Build webpack completo PASS. El build Turbopack local falló por restricción del sandbox al abrir puerto; no se presenta como fallo de código ni como build exitoso.
- Fixture contra el publicador existente PASS: dos respuestas simuladas, fuentes, PNG1600×900 y paquete válido; digest `479dfa74ccbf6ed9d344afff9a886eeb1fa89c121723d13c7f8246b51e35c385`. AUTO_PUBLISH85 sólo elegible controlado, sin publicación.
- Mismo bundle en Code node Cloud con datos sintéticos y cero llamadas: request preparada, writer/QA y elegibilidad85; facts=false fuerza REJECT/INELIGIBLE/score null. No pins/harnesses publicados. Idempotencia/cancelación mantienen pruebas controladas; timeout y rechazo por formato tienen ahora evidencia viva.
- Revisión independiente del cambio final CommonJS sin hallazgos bloqueantes. PR75/PR74 ya mergeadas; este hotfix continúa la implementación existente y no abre arquitectura/PR competidora. Web/publicador sin cambios.

### KNOWLEDGE DELTA y próximo gate

Implementado: sí, corrección de credencial/runtime. Mergeado: #75/#74 sí; hotfix de compatibilidad identificado por el commit portador de este receipt. Desplegado: Portal Production y n8n Published. Transporte con proveedor/callback/persistencia vivo: sí. E2E editorial con QA/portada/preview: **no**. Radar V1 productivo con revisión humana: **no**. Autónomo: **no**.

No queda intervención de credenciales. Próximo trabajo técnico: exigir forma JSON/schema del escritor y QA conforme al contrato existente, preservando web search, una corrección máxima y gates; probar offline antes de publicar. La validación viva posterior exige autorización explícita de presupuesto adicional: una reservaUSD1.50 llevaría el ledger aUSD6.00, por encima del pilotoUSD5. No asumir esa autorización ni reducir/refundir reservas para simular disponibilidad. Mantener scheduler/autopublicación OFF.

## Diagnóstico productivo del callback — 2026-09-21, 14:00 ART

**BLOCKED_EXTERNAL: causa de header confirmada; secreto nuevo aplicado y validado en producción. Falta guardar la credencial n8n. Sin nueva corrida E2E.**

EXECUTION PREFLIGHT: tarea desktop existente, workspace-write y auto-review reales; no se afirma sesión trusted del piloto. Resultado autorizado: resolver 401 productivo, conservar arquitectura y ejecutar un único E2E después de validar autenticación. Canon Alanos `d86d94006fd2f9b5ba2692ac642b074cdeaf116a`; contrato de runtime, hogar Radar, WIP/sync y políticas de capacidad/riesgo leídos. Budget M / T2 / R3; A0 reutilizar Portal/n8n/Supabase/publicador. Un integrador y revisión independiente acotada de autenticación (sin secretos ni cambios). Fuera de alcance: cron, autopublicación, nueva plataforma, reset/refund del ledger, cambios GlobalTrip. STOP ante credencial que exige entrada humana; recuperar guardando configuración segura existente, sin pruebas ciegas. Validación: comparar export vivo, deployment/scopes, logs/DB; probe sin run ni reserva antes de una única corrida E2E. Challenge: no se justifica cambiar código ni revertir trim; el header configurado es incorrecto. Revisión independiente confirma que el 401 ocurre antes de Supabase/presupuesto y que el probe con runId inválido retorna 400 si auth pasa.

- PR #75 merge `bd1f080`, PR #74 merge `baa4e61`. Portal main `e1a662e`, con hotfix `2708a33` y regresión de whitespace. Vercel UI confirma Production Current / Ready en `dpl_HJvZo3Q4rjPSjVaoxi6jZ5MTPLMu`, origen `portal.nexopstech.com`, commit `e1a662e`.
- Ejecución n8n `31193` (16:46:47 UTC) usa versión publicada `833655f8-800a-4735-b511-89a136cacf20` y apunta al run `8c7aa196-4d56-41b6-bc25-f7e9f687896c`. Header Auth seleccionado: `Radar — Callback`, ID `2d7kaGGilIP7QZKy`.
- **Causa concreta:** el Name de esa credencial no es el header exacto; contiene un sufijo pegado después de `x-radar-callback-secret`. El campo Value aparece vacío. No guardar el sufijo ni valores en evidencia. Esto basta para explicar que `headers.get("x-radar-callback-secret")` no reciba la credencial esperada. No es prueba de igualdad/desigualdad del secreto Production.
- Export vivo descargado mediante UI y comparado con Git: los diez nodos, conexiones y código coinciden en la lógica; los cuatro callbacks tienen parámetros idénticos y usan la misma credencial Callback. Dispatch usa `Radar — Dispatch`, ID `Ag6pRVSFlbsqSM7W`, separada de GlobalTrip. No pinData. La versión del export coincide con la ejecución fallida.
- Deltas de configuración: webhook vivo usa respuesta inmediata por defecto 200 frente al 202 explícito del export. Settings vivos perdieron timeout 240 y políticas saveData* del export, lo que explica ejecuciones fallidas persistidas. Se restauraron y verificaron por nuevo export `executionTimeout=240`, saveDataErrorExecution/saveDataSuccessExecution=none y saveExecutionProgress/saveManualExecutions=false. Workflow continúa Published, misma versión; ningún otro workflow fue modificado.
- Vercel UI y metadata CLI: una fila Callback Secret para Production; otra Config sólo Preview/branch `codex/radar-api-mvp`; búsqueda en Shared sin resultados. No shadowing Production observado. Production es Secret no revelable en la UI; no se afirma comparación de valores efectivos. La lectura REST inicial con token local devolvió 403 y el conector presentó errores de lookup; luego `vercel whoami` renovó correctamente la sesión existente (`sysnexops-7509`) y `vercel api` accedió al proyecto `prj_XZ78r6Rwyu8TT6khC3LO1U3sm2Wa`, sin ampliar permisos.
- Logs Vercel del deployment confirman POST callback HTTP401 a las 16:46:48.850 UTC y POST de operación HTTP200 a las 16:46:46.519 UTC; no es bloqueo de Deployment Protection.
- Alan pidió explícitamente generar una corrección con secreto nuevo. Se generaron 64 caracteres criptográficamente aleatorios y se actualizó sólo la fila Production `RcRTKZ4B3NAth6Ya` como Secret vía CLI/stdin, sin exponer el valor. Copia temporal local 0600 para la única entrada humana en n8n, con retiro pendiente después de guardarlo. Redeploy del mismo commit `e1a662e` **READY/Production**, dominio `portal.nexopstech.com`: `dpl_FP2VB3qzv6o6ENgig7zzSTVJaoy5`. Probe con ese secreto y runId inválido devolvió HTTP400 `Invalid run`, no 401; la ruta rechaza antes de Supabase/reserva/OpenAI. Esto prueba el secreto efectivo del deployment, no un callback de n8n. La clave OpenAI existente no cambia.
- Revalidación posterior al pedido de Alan: credencial n8n recargada desde servidor, Name aún incorrecto y Value aún vacío. No se disparó una corrida. Única edición humana pendiente: Name exacto y Value nuevo en Radar — Callback; Computer Use exige handoff para entrada/guardado de credenciales. Después, un único E2E por el agente.
- Supabase confirma run fallido `api_usage={}`, `n8nExecutionId=null`; ledger `reserved_runs=1`, USD 1.50. Scheduler false y publishingMode/autonomy review en ambos workspaces. Nuevo gasto: USD 0.

## Revalidación viva — 2026-09-21 (corte anterior 10:40 ART)

**BLOCKED_EXTERNAL antes de Buscar ahora. No E2E cerrado ni Radar V1 productivo.** Este delta sustituye el diagnóstico de importación pendiente del receipt histórico que sigue debajo.

### EXECUTION PREFLIGHT / alcance de esta reanudación

- Rol/superficie: ejecución técnica y sincronización documental expresamente solicitadas por Alan, en la tarea desktop existente; cwd es el espejo local de “Rol estrategico”, no se afirma sesión trusted Alanos. Permisos efectivos: workspace-write, red restringida con revisión automática de escalaciones; no se modificaron. Las lecturas de infraestructura usan conectores/autenticaciones autorizadas.
- Contexto: Alanos `35a7dfa1896f2ac4cdbcbe135d7419a9cc731620`; leídos `Execution_Runtime_Contract.md`, `NexOps_Content_Engine.md`, `AGENTS.md`, `Ultimo_Sync.md`, `Cola_Ejecucion.md` y las políticas de ejecución/capacidad/receipt/sync pertinentes. Sólo este resultado fue retomado.
- Budget M / T2 / R2 para reconciliación del piloto; promoción productiva y cambios de secretos compartidos son gate R3, no alcanzado. A0: reutilizar PR #75/#74 y runtime n8n existente. Sin rediseño, nuevo servicio, migración ni cambios de permiso.
- Capacidad: un escritor; inspección estructurada de Git/CI/Supabase y UI sólo para configuración real de n8n/Portal. Sin subagentes en este diagnóstico bloqueado; revisión independiente obligatoria antes de una eventual promoción de riesgo R3. No repetir suites completas del mismo commit.
- Aceptación: corrida autorizada desde Buscar ahora, IDs/uso/costo/callback/paquete/preview reales antes de integrar. STOP ante credencial incorrecta, sesión ausente o denegación del proveedor. No gastar reservas para diagnosticar configuración ya inválida. Rollback: no hubo cambios de runtime productivo ni ledger.

### Evidencia actual obtenida

- Git remoto: Portal PR #75 permanece draft/open, head `3641c37a3e204490579f8e59e98b27c80fe00a29`; Web #74 draft/open, head `66d98f2529bc555b8b5001d2184e20aeb0afac56`. Ambos reportan mergeable=true; no es autorización de merge. `origin/main` real del Portal avanzó a `ac2e87e25fbe6db62b17f8038edfd910d78aa6a7` y Web a `4e6aad87c88720ab63c5b9c42b2f08ce0e00b042`; la integración contra esos estados no se ejecutó.
- GitHub sigue mostrando CI Portal run 131 y Web run 337 SUCCESS, además de sus checks de despliegue Preview. El incremento documental `9dc9a89` también pasó [CI 142](https://github.com/AlanTN13/nexopsticketera/actions/runs/35607337761) y ambos deploys Vercel. Es evidencia de esos commits, no una nueva corrida E2E ni de producción.
- n8n vivo: workflow `BRbvcSEHpTIMpw63`, “Radar NexOps — n8n controlled pilot”, **Published**. El canvas tiene los diez nodos y el ciclo esperado; Private webhook POST `radar-nexops-v1`, sin trigger de cron visible. Esto corrige el estado canónico anterior “no instalado”. No se certificó igualdad byte a byte del código exportado con la instancia.
- Private webhook usa Header Auth account 2, ID `3CkSedfe5fMljbdt`; su Name visible es `x-radar-dispatch-secret`. **Claim run usa esa misma credencial**, aunque el backend exige `x-radar-callback-secret`. Las credenciales de despacho y callback no están separadas correctamente.
- La ficha de dependencias de esa credencial confirma dos consumidores: Radar y “GlobalTrip - Courier aereo V1 - PREVIEW”. No se leyó/reveló su Value, no se editó ni se afirma que GlobalTrip esté funcionando o caído. No reutilizar ni modificar nuevamente esa credencial compartida para cerrar Radar.
- OpenAI web search tiene seleccionado `OpenAi account`, llama a `/v1/responses`, usa `$json.request`, timeout 45000 ms y redirects apagados. Selección de credencial no equivale a prueba de proveedor.
- Variables de n8n: la UI mostraba “Create your first variable”; se guardó `RADAR_PORTAL_ORIGIN` con `https://sdnexops-git-codex-rad-53fbac-alan-fernandezs-projects-f6e1f457.vercel.app`. La tabla confirmó la variable y muestra Scope Global. Es una URL no secreta, exclusiva de este piloto; no se habilitaron cron ni publicación. Reversión: retirar esa variable si se abandona la configuración del piloto.
- Portal Preview de la rama responde, pero navegar a `/backoffice/radar/operacion` redirige a `/portal/login?reason=session`. Falta una sesión administrativa real para Buscar ahora.
- Dos POST sin credenciales al endpoint n8n del Preview devolvieron HTTP 401; en el segundo se confirmó Content-Type application/json. No se enviaron secretos, no se disparó n8n/OpenAI y no se usó un run real. Esto es evidencia negativa de rechazo HTTP, no un callback autenticado exitoso.
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
