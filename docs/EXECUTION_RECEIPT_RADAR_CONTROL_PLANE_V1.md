# EXECUTION RECEIPT — Radar Control Plane V1

Estado: `VALIDATED_CODE / BLOCKED_EXTERNAL`

Fecha: 2026-09-01

Decisión canónica: `AlanTN13/Alanos#48`

Issue técnico: `AlanTN13/nexopsticketera#56`

Branch: `codex/radar-control-plane-v1`, apilada sobre el PR draft `#55`

PR draft: `AlanTN13/nexopsticketera#57`

Commit funcional validado: `9cde6d08548520a6a952ff1183fbacf708ee585e`

## Resultado

- Radar se opera desde `/portal/radar/operacion`; no existe un nuevo cerebro editorial ni una aplicación paralela.
- El Portal conserva sesión, workspace, empresa, permisos, configuración, solicitudes, progreso, candidatos, decisiones e historial visible.
- `webneoxps` sigue siendo el destino server-to-server para ejecutar el motor editorial.
- La publicación y el scheduler productivo permanecen bloqueados por diseño.
- No se tocó producción, no se modificaron credenciales y no se ejecutó Meta.

## Contrato de seguridad

- `view`: lectura de settings, corridas, eventos y decisiones del workspace autorizado.
- `operate`: iniciar una corrida y decidir un candidato en revisión.
- `admin`: preparar frecuencia, horario y autonomía; no puede activar el scheduler V1.
- La habilitación comercial sigue reservada al `platform_admin` y sincroniza el estado del control plane.
- Server Actions revalidan sesión y workspace. Los RPC vuelven a validar nivel y estado. RLS aísla todas las lecturas. Las escrituras directas están revocadas.
- La devolución del motor exige HMAC sobre el cuerpo crudo, URLs HTTPS seguras, candidato proyectado y una transición de estado permitida.
- Idempotencia: una solicitud por `workspace + key`, una decisión por `run + key` y una sola corrida activa por workspace.

## Persistencia

- `radar_control_settings`: habilitación, modo, frecuencia preparada y próxima corrida.
- `radar_runs`: solicitud, modo, estado, referencia externa, candidato, resultado, error y URL final.
- `radar_run_events`: progreso visible.
- `radar_run_decisions`: aprobación, descarte o postergación durable.
- `NO_PUBLICATION` es un estado terminal durable en el Portal; la confirmación end-to-end contra `radar-history` queda pendiente del runner real.

## Evidencia ejecutada

- Supabase local reconstruido desde cero con las 20 migraciones: `PASS`.
- Harness SQL transaccional `supabase/tests/radar_control_plane_v1.sql`: `PASS / ROLLBACK`.
- Matriz A/B: lectura por URL/ID, acción directa, nivel insuficiente, administración y aislamiento: `PASS`.
- Reintento de solicitud y decisión: `PASS`, sin duplicados.
- `NO_PUBLICATION` local durable y scheduler apagado: `PASS`.
- Vitest: `38 archivos / 168 pruebas`: `PASS`.
- TypeScript: `PASS`.
- ESLint: `PASS`.
- Build Next.js 16: `PASS`, incluida `/api/radar/runs/[runId]/events` y `/portal/radar/operacion`.
- Navegador autenticado local: login, URL de Operación, contenido, controles, estado pausado e historial: `PASS`; sin overlay ni errores de consola.
- GitHub Actions `verify`: `PASS`.
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
- El scheduler nuevo del Portal queda persistido como `scheduler_enabled = false`; V1 rechaza cualquier intento de activarlo.

## Acción externa requerida para completar el circuito real

1. Definir o señalar el runner de investigación real que debe recibir `radar_control_plane_run`; el repositorio actual no contiene esa capacidad invocable.
2. En un gate posterior, configurar el token GitHub de despacho y el secreto HMAC compartido, sin exponerlos al navegador.
3. Autorizar por separado migración/despliegue seguro y una única corrida `suggest` o `review` sin publicación.

Hasta esas acciones, la UI falla cerrado y muestra “Motor pendiente de conexión”.
