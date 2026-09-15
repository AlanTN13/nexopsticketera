# EXECUTION RECEIPT — Radar API MVP

## Resultado / estado
Integración preparada para validar Buscar ahora en sdnexops Preview. API y publicación apagadas durante preparación; cron de investigación bloqueado en código. No se publicó contenido ni se reconcilió historia. Evidencia de proveedor hasta aquí simulada: consumo real OpenAI USD0.

## Equipo y decisiones
Dirección implementó motor API, captura de configuración/corpus, límites, seguimiento, integración y gates globales. Especialista publication_preview implementó PNG/paquete/preview/sitio; especialista durable_state implementó migración/tests SQL y realizó revisión independiente de worker/persistencia. Paralelismo con superficies separadas; Dirección integró ambos contratos. Nivel A1: extensión del backend y Supabase existentes, sin servicios nuevos.

## Challenge y correcciones
Se cerraron carreras de worker sin reserva propia, callbacks de intento anterior y fallos de despacho de publicación. Reservas monetarias persistentes no se pierden con checkpoints. Fuente manual debe aparecer en evidencia consultada; claims y verificación pública se guardan. NO_PUBLICATION, REJECT y FAILED conservan significado distinto. Reintentos de publicación no repiten investigación; conservan composición exacta y bloquean merge pendiente de verificar.

## Evidencia
- Base Portal main 8b6e7d5; web main 760e328.
- Portal 225 tests PASS; lint/typecheck/build PASS; regresión PostgreSQL aislada (PGlite) con migraciones reales PASS y agregada a CI.
- Web news:test completo61/61, radar5/5; lint/build/audit/SEO PASS.
- Integración entre repos: proveedor simulado → nota → QA → PNG → paquete firmado → validador/materializador real del sitio, PASS; 2 llamadas simuladas,2 fuentes,2 archivos finales. Script `scripts/verify-radar-package.cjs` requiere repos hermano web.
- Supabase existente tfonsiurhjmllqaknhgh: migración aditiva radar_api_bounded_state aplicada 2026-09-15, permisos service-only verificados. Workspace interno nexops-api-pilot con preferencias NexOps y company_id null. Sólo platform admins activos por política vigente.
- Reserva acumulada inicial0USD/0runs. #4canceled/#5dispatching verificadas sin cambios.
- Secret OPENAI_API_KEY inyectado por usuario en Vercel sdnexops Preview rama codex/radar-api-mvp mediante tarea de configuración. Dirección no leyó/copió el secreto.

## Gates y límites
Preview y CI remotos, smoke autenticado y costo real se agregan al validar. USD5 total autorizado, USD1.50 conservadores reservados/run, máximo3 corridas iniciales. Objetivo normal <=USD0.20 pendiente de medición. Aplicación no tiene autopublicación; RADAR_PUBLICATION_ENABLED=false. Publicar o reconciliar histórico requiere gate posterior del encargo. Rollback operativo: deshabilitar API, conservar tablas/estados/paquetes, no activar fallback Work.

## KNOWLEDGE DELTA PROPUESTO
- Radar API MVP ya tiene implementación integrada y migración aditiva; aún no equivale a una nota real ni a producción publicada.
- sdnexops/portal.nexopstech.com es destino correcto, Fluid enabled Hobby, deadline240s/maxDuration300s.
- Historial anterior está preservado y aislado del piloto nexops-api-pilot.
- Fuentes completas, PNG y aprobación exacta sustituyen el contrato SVG defectuoso.
- Reconciliación estratégica incremental pendiente al recibir evidencia final de PR/preview/smoke.
