# EXECUTION RECEIPT — Radar Control Plane V1

Estado: `VALIDATED_CODE / BLOCKED_EXTERNAL`

Fecha: 2026-09-01

Decisión canónica: `AlanTN13/Alanos#48`

Issue técnico: `AlanTN13/nexopsticketera#56`

Issue de integración del motor: `AlanTN13/webneoxps#70`

Branch: `codex/radar-control-plane-v1`, basada en `main` después del merge de `#55`

PR draft: `AlanTN13/nexopsticketera#57`

Commit funcional validado: `8a43f4e`

## Resultado

- Radar se opera desde `/portal/radar/operacion`; no existe un nuevo cerebro editorial ni una aplicación paralela.
- La cuenta madre y cada workspace autorizado pueden configurar temáticas, frecuencia de una a seis notas por semana y comportamiento sugerir/descartar.
- “Nueva nota” es un ingreso manual separado de “Buscar oportunidades”: guarda fuente y contexto, exige HTTPS pública y entra siempre por revisión.
- El Portal conserva sesión, workspace, empresa, permisos, configuración, solicitudes, progreso, candidatos, decisiones e historial visible.
- `webneoxps` sigue siendo el destino server-to-server para ejecutar el motor editorial.
- La publicación y el scheduler productivo permanecen bloqueados por diseño.
- No se tocó producción, no se modificaron credenciales y no se ejecutó Meta.

## Contrato de seguridad

- `view`: lectura de settings, corridas, eventos y decisiones del workspace autorizado.
- `operate`: iniciar una búsqueda, ingresar una nota manual y decidir un candidato en revisión.
- `admin`: preparar preferencias editoriales, frecuencia, horario y autonomía; no puede activar el scheduler V1.
- La habilitación comercial sigue reservada al `platform_admin` y sincroniza el estado del control plane.
- Server Actions revalidan sesión y workspace. Los RPC vuelven a validar nivel y estado. RLS aísla todas las lecturas. Las escrituras directas están revocadas.
- La devolución del motor exige HMAC sobre el cuerpo crudo, URLs HTTPS seguras, candidato proyectado y una transición de estado permitida.
- Idempotencia: una solicitud por `workspace + key`, una decisión por `run + key` y una sola corrida activa por workspace.

## Persistencia

- `radar_control_settings`: habilitación, preferencias editoriales, modo, frecuencia preparada y próxima corrida.
- `radar_runs`: tipo de solicitud, payload seguro de nota manual, modo, estado, referencia externa, candidato, resultado, error y URL final.
- `radar_run_events`: progreso visible.
- `radar_run_decisions`: aprobación, descarte o postergación durable.
- `NO_PUBLICATION` es un estado terminal durable en el Portal; la confirmación end-to-end contra `radar-history` queda pendiente del runner real.

## Evidencia ejecutada

- Supabase local reconstruido desde cero con las 20 migraciones: `PASS`.
- Harness SQL transaccional `supabase/tests/radar_control_plane_v1.sql`: `PASS / ROLLBACK`.
- Matriz A/B: lectura por URL/ID, acción directa, nivel insuficiente, administración y aislamiento: `PASS`.
- Reintento de solicitud y decisión: `PASS`, sin duplicados.
- Preferencias editoriales por workspace y alta manual segura: `PASS`.
- `NO_PUBLICATION` local durable y scheduler apagado: `PASS`.
- Vitest: `38 archivos / 169 pruebas`: `PASS`.
- TypeScript: `PASS`.
- ESLint: `PASS`.
- Build Next.js 16: `PASS`, incluida `/api/radar/runs/[runId]/events` y `/portal/radar/operacion`.
- Navegador autenticado local: configuración, persistencia, confirmación de guardado, alta manual visible, programación y ausencia del disclaimer amarillo: `PASS`. El modo desarrollo registra únicamente la advertencia esperada de CSP/`eval`; el build productivo compila limpio.
- GitHub Actions `verify`: `PASS` — corrida `33521316600`.
- Vercel `nexopsticketera`: `PASS` — preview `https://nexopsticketera-git-co-fb7d18-alan-fernandezs-projects-f6e1f457.vercel.app` (SSO protegido).
- Vercel `sdnexops`: `PASS` — preview `https://sdnexops-git-codex-rad-47291d-alan-fernandezs-projects-f6e1f457.vercel.app` (SSO protegido).

## Gates no ejecutados

- Migración productiva: `OFF`.
- Credenciales server-to-server Portal ↔ motor: `OFF`.
- Scheduler del producto: `OFF`.
- Publicación automática/productiva: `OFF`.
- Corrida editorial real desde Portal: `BLOCKED_EXTERNAL`; `webneoxps` conserva ejecución/validación/publicación de candidatos, pero no expone hoy un runner de investigación invocable que acepte `radar_control_plane_run`.

## Estado exacto de schedulers externos

- La tarea diaria de ChatGPT/Codex `radar-nexops-ciclo-diario` fue eliminada y no se restauró.
- Los workflows técnicos existentes de `webneoxps` siguen presentes; no se eliminaron ni pausaron.
- Ningún workflow actual de `webneoxps` tiene `schedule:`. El de publicación autónoma sólo reacciona a PR confiable y conserva sus gates.
- El scheduler nuevo del Portal queda preparado para lunes a sábado, una vez dentro de la franja `07:00–07:59 America/Argentina/Buenos_Aires`, con `scheduler_enabled = false` hasta conectar el runner; V1 rechaza activarlo antes de ese gate.

## Acción externa requerida para completar el circuito real

1. Definir o señalar el runner de investigación real que debe recibir `radar_control_plane_run`; el repositorio actual no contiene esa capacidad invocable.
   Ese runner debe distinguir `intent: opportunity_search | manual_note` y, para `manual_note`, consumir el bloque seguro `manualNote`.
2. En un gate posterior, configurar el token GitHub de despacho y el secreto HMAC compartido, sin exponerlos al navegador.
3. Autorizar por separado migración/despliegue seguro y una única corrida `suggest` o `review` sin publicación.

Hasta esas acciones, la UI falla cerrado y muestra “Motor pendiente de conexión”.
