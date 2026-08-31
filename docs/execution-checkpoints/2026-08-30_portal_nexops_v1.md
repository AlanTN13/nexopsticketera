# EXECUTION CHECKPOINT — Portal NexOps V1

Fecha: 2026-08-30

## Proyecto / resultado

Evolución de Ticketera a Portal NexOps V1 con Inicio, Soporte y Métricas bajo una sola sesión.

## Estado

`IMPLEMENTED_PREVIEW_PENDING`

La integración está implementada localmente y validada a nivel estático. La reportería real y el smoke autenticado dependen de insumos externos detallados en Bloqueos.

## Repo / branch / issue

- Repo: `AlanTN13/nexopsticketera`
- Base: `main` en `587d874`
- Branch: `codex/portal-nexops-v1`
- Issue: `AlanTN13/nexopsticketera#30`

## Arquitectura implementada

- `/portal`: Inicio y resumen de Soporte.
- `/portal/soporte`: experiencia existente de tickets.
- `/portal/metricas`: componentes y lógica del prototipo de Joaquín dentro del shell del Portal.
- Supabase Auth, empresa, sesión, permisos y backoffice existentes, sin una segunda autenticación.
- URLs de Google Sheets únicamente en variables de servidor y con allowlist de host.
- Filtrado exacto de filas por empresa en servidor antes de serializar datos al navegador.
- Configuración mínima por empresa para habilitar u ocultar Métricas.

## Evidencia local

- `npm run lint`: verde.
- `npm run typecheck`: verde.
- `npm test`: 24 archivos / 96 tests verdes.
- `npm run build`: verde.
- `git diff --check`: verde.
- Aislamiento empresa A/B: cubierto por tests del loader server-side.

## Riesgos conocidos

- `main` no tiene protección de rama configurada.
- `npm audit --omit=dev` informa vulnerabilidades altas preexistentes en la cadena de Next.js 16.2.12; el gate CI vigente bloquea críticas y continúa verde. Dependabot PR #25 propone Next.js 16.3.3 y debe resolverse como cambio separado.
- Las URLs de métricas no estaban incluidas en el ZIP del prototipo y no se incorporaron datos falsos.

## Bloqueos

### Gate externo — datos y validación funcional

- URL publicada del Google Sheet de Meta Ads.
- URL publicada del Google Sheet de Mailchimp si se habilita Emailing.
- Cuenta sintética o autorizada gestionada por el mecanismo existente para completar el smoke autenticado.

### Gate de dominio

Antes de activar `portal.nexopstech.com` deben agregarse el dominio en Vercel y sus redirects permitidos en Supabase Auth. `soporte.nexopstech.com` debe mantenerse compatible.

## Siguiente movimiento

1. Publicar branch y PR draft para obtener preview.
2. Ejecutar smoke público y responsive sobre preview.
3. Conectar las fuentes reales por variables server-side y completar el smoke autenticado.
4. Resolver el gate de dependencias y dominio antes del merge/producción.
