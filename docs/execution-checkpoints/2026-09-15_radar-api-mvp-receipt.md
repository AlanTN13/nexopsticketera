> HISTORICAL / SUPERSEDED: the direct backend worker described here was removed by the n8n reconciliation. See `2026-09-17_radar-n8n-reconciliation.md`. Do not activate the old runtime.

# EXECUTION RECEIPT — Radar API MVP

## Resultado / estado
Integración preparada para validar Buscar ahora en sdnexops Preview. API habilitada exclusivamente en Preview rama codex/radar-api-mvp; publicación apagada; cron de investigación bloqueado en código. No se publicó contenido ni se reconcilió historia. Evidencia de proveedor hasta aquí simulada: consumo real OpenAI USD0.

## Equipo y decisiones
Dirección implementó motor API, captura de configuración/corpus, límites, seguimiento, integración y gates globales. Especialista publication_preview implementó PNG/paquete/preview/sitio; especialista durable_state implementó migración/tests SQL y realizó revisión independiente de worker/persistencia. Paralelismo con superficies separadas; Dirección integró ambos contratos. Nivel A1: extensión del backend y Supabase existentes, sin servicios nuevos.

## Challenge y correcciones
Se cerraron carreras de worker sin reserva propia, callbacks de intento anterior y fallos de despacho de publicación. Reservas monetarias persistentes no se pierden con checkpoints. Fuente manual debe aparecer en evidencia consultada; claims y verificación pública se guardan. NO_PUBLICATION, REJECT y FAILED conservan significado distinto. Revisión final cerró pérdida de URLs y contador web ante JSON inválido/respuesta incompleta: checkpoint de metadatos seguros previo al parser; dos regresiones nuevas PASS. Reintentos de publicación no repiten investigación; conservan composición exacta y bloquean merge pendiente de verificar.

## Evidencia
- Base Portal main 8b6e7d5; web main 760e328.
- Portal 227 tests PASS (225 iniciales + 2 regresiones de respuesta incompleta); lint/typecheck/build PASS; regresión PostgreSQL aislada (PGlite) con migraciones reales PASS y agregada a CI.
- Web news:test completo61/61, radar5/5; lint/build/audit/SEO PASS.
- Integración entre repos: proveedor simulado → nota → QA → PNG → paquete firmado → validador/materializador real del sitio, PASS; 2 llamadas simuladas,2 fuentes,2 archivos finales. Script `scripts/verify-radar-package.cjs` requiere repos hermano web.
- Supabase existente tfonsiurhjmllqaknhgh: migración aditiva radar_api_bounded_state aplicada 2026-09-15, permisos service-only verificados. Workspace interno nexops-api-pilot con preferencias NexOps y company_id null. Sólo platform admins activos por política vigente.
- Reserva acumulada inicial0USD/0runs. #4canceled/#5dispatching verificadas sin cambios.
- Secret OPENAI_API_KEY inyectado por usuario en Vercel sdnexops Preview rama codex/radar-api-mvp mediante tarea de configuración. Dirección no leyó/copió el secreto.

## PR y previews integrados
- Portal PR [nexopsticketera#75](https://github.com/AlanTN13/nexopsticketera/pull/75), implementación 7023f75 y corrección del harness CJS 6b0a6b9 y preservación de evidencia incompleta 25f2a32. CI verify SUCCESS (run35007452532 sobre25f2a32), Vercel sdnexops SUCCESS (AMMjDDHWutNCX2b4RKdddxppmADH).
- [Portal Preview](https://sdnexops-git-codex-rad-53fbac-alan-fernandezs-projects-f6e1f457.vercel.app/backoffice/radar/operacion).
- Sitio PR [webneoxps#74](https://github.com/AlanTN13/webneoxps/pull/74), commit0c4f42c; CI validate SUCCESS y publisher SKIPPED. [Sitio Preview](https://deploy-preview-74--webnexops.netlify.app/radar/preview) usa el despliegue automático Netlify existente de la misma PR. El corpus público devuelve schema1/nexops/18 notas; el preview Vercel está protegido y devuelve login, por eso no se usa como corpus server-side.
- Smoke real de navegador local Chrome: opener → web compilada → artículo con PNG y dos fuentes → confirmación de versión exacta PASS. Proveedor simulado, sin consumo API. Smoke autenticado remoto pendiente: el preview requiere login propio de administrador. Pantalla abierta por la tarea de configuración; no se omite autorización ni se pide la key otra vez.
- PostgreSQL tests usan las migraciones reales sobre PGlite; no equivalen a una prueba multisesión de concurrencia. Los locks/condiciones fueron revisados por separado.

## Gates y límites
Secreto server-only y diez parámetros de configuración confirmados guardados por la tarea de configuración sólo en Preview/rama; OPENAI_API_KEY no fue leído por Dirección. Único gate externo actual: iniciar sesión administradora en el preview para disparar Buscar ahora. No se efectuó ninguna llamada real; no hay nota real ni medición de costo todavía. USD5 total autorizado, USD1.50 conservadores reservados/run, máximo3 corridas iniciales. Objetivo normal <=USD0.20 pendiente de medición. Aplicación no tiene autopublicación; RADAR_PUBLICATION_ENABLED=false. Publicar o reconciliar histórico requiere gate posterior del encargo. Rollback operativo: deshabilitar API, conservar tablas/estados/paquetes, no activar fallback Work.

## KNOWLEDGE DELTA PROPUESTO
- Radar API MVP ya tiene implementación integrada y migración aditiva; aún no equivale a una nota real ni a producción publicada.
- sdnexops/portal.nexopstech.com es destino correcto, Fluid enabled Hobby, deadline240s/maxDuration300s.
- Historial anterior está preservado y aislado del piloto nexops-api-pilot.
- Fuentes completas, PNG y aprobación exacta sustituyen el contrato SVG defectuoso.
- Reconciliación estratégica incremental pendiente al recibir evidencia final de PR/preview/smoke.
