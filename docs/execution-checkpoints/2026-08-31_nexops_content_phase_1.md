# EXECUTION RECEIPT — NexOps Contenido · Fase 1

Estado: READY_FOR_META_SMOKE

## Trazabilidad

- Request canónico: `AlanTN13/Alanos#45`.
- Issue técnico: `AlanTN13/nexopsticketera#48`.
- Repo: `AlanTN13/nexopsticketera`.
- Branch: `codex/nexops-content-phase-1`.
- PR draft: `AlanTN13/nexopsticketera#49`.
- Preview primario: `https://nexopsticketera-git-co-5d3214-alan-fernandezs-projects-f6e1f457.vercel.app`.
- Preview secundario: `https://sdnexops-git-codex-nex-89ee75-alan-fernandezs-projects-f6e1f457.vercel.app`.

## Technical Snapshot

- Base transversal: Alanos #46 / técnico #51 / PR #52 `VALIDATED` y mergeado a `main` antes de cerrar Contenido.
- Head validado: `codex/nexops-content-phase-1` sobre `main`, con permisos comunes y sin autorización paralela.
- Stack: Next.js 16 App Router, Supabase Auth/Postgres, Vercel y módulos por empresa.
- Patrones reutilizados: `company_modules`, niveles `view/operate/admin`, DAL `server-only`, Server Actions, cron autenticado, claims transaccionales y RLS por empresa.
- Clasificación: `T3 / L / R3`.
- Arquitectura: `A1`, extensión del monolito modular; sin aplicación ni servicio nuevo.

## Alcance congelado

Incluye módulo Contenido, configuración Instagram por workspace, watchlist, conexión oficial Meta, recolección normalizada, historial, corridas, errores, sincronización manual y job semanal.

No incluye análisis, scoring, benchmark razonado, estrategia, calendario, briefs, generación ni publicación.

## Topología de ejecución

- Dirección de Ejecución: integración, implementación principal, Git/PR, validación global y cierre.
- Integraciones: contrato oficial Meta y bloqueo externo mínimo.
- Datos y seguridad: revisión independiente de migración, RLS, secretos, idempotencia, aislamiento y rollback.

## Gates

- [x] Issue técnico creado.
- [x] PR draft abierto.
- [x] Migraciones aditivas aplicadas y versiones repo/productivo alineadas.
- [x] Entitlement y rutas del módulo.
- [x] DAL y acciones autorizadas por workspace y nivel.
- [x] Adaptador Meta server-only, paginado y con manejo de rate limit/reconexión.
- [x] Sync manual, cooldown, idempotencia y lease fencing.
- [x] Cron semanal instalado y condicionado a `scheduled_enabled`; piloto en `false`.
- [x] Aislamiento A/B, secretos y payloads crudos verificados.
- [x] Suite 38 archivos / 178 tests, lint, typecheck y build webpack.
- [x] CI y dos previews READY.
- [x] Smoke no autenticado: `/portal/contenido/fuentes` redirige al login sin error boundary.
- [ ] OAuth y dos sincronizaciones reales: bloqueadas únicamente por configuración externa de Meta.

## Evidencia Supabase productiva

- Proyecto existente: `tfonsiurhjmllqaknhgh`; no se creó proyecto ni branch adicional.
- Migraciones remotas: `20260901115425_nexops_content_phase_1_v2`, `20260901115713_fix_content_lease_trigger`, `20260901115759_fix_content_media_persistence`.
- Harness `supabase/tests/content_phase_one_rls.sql`: PASS dentro de `BEGIN/ROLLBACK`.
- Contratos probados: provisioning por módulo, aislamiento empresa A/B, denegación de credenciales/raw payloads, pending OAuth con TTL, finalización atómica, watchlist 5+3, identidad estable de publicaciones, snapshot sólo ante cambio y rechazo de lease vencido.
- Estado posterior: 3 empresas, 5 usuarios, sólo `sysnexops` con Contenido habilitado, un workspace con agenda apagada, 0 conexiones, 0 cuentas, 0 corridas y 0 fixtures.
- Advisors: sin hallazgo bloqueante nuevo. Las tablas de credenciales y estados OAuth muestran RLS sin policy de forma intencional para denegar todo acceso autenticado; sólo `service_role` opera. Los avisos de índices son informativos y no bloquean el piloto vacío.

## Evidencia de aplicación

- `npm run typecheck`: PASS.
- `npm test -- --run`: 38 archivos / 178 tests PASS.
- `npm run lint`: PASS.
- `npm run build -- --webpack`: PASS.
- CI `verify`: PASS.
- Vercel `nexopsticketera` y `sdnexops`: READY.
- El primer smoke del preview detectó una sesión ausente presentada como error boundary; se corrigió con redirección de página a `/portal/login?reason=session` y el segundo smoke mostró el login esperado, sin un error nuevo de runtime.

## Gate externo de Meta

- Vercel fue inspeccionado sin revelar valores: `CRON_SECRET` ya existe y las variables `META_*` todavía no están cargadas.
- Callback canónico a registrar en Meta: `https://portal.nexopstech.com/api/meta/instagram/callback`.
- Configuración server-only requerida en Vercel: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_LOGIN_CONFIG_ID`, `META_OAUTH_REDIRECT_URI` y `META_TOKEN_ENCRYPTION_KEY`.
- Acción externa: crear o seleccionar la app Business de NexOps, configurar Facebook Login for Business, vincular la cuenta profesional de Instagram con su Página y autorizar las capacidades de lectura e insights solicitadas por el Portal.
- Una vez cargada la configuración, el cierre exige dos sincronizaciones manuales reales sin duplicados; recién entonces se habilita `scheduled_enabled`.

## Rollback

Deshabilitar el entitlement y `scheduled_enabled` detiene exposición y recolección. Las migraciones son aditivas: ante defecto se conserva historial y se aplica forward-fix; no se ejecutaron `DROP`, borrados ni backfills destructivos.

## Resultado final

Todo lo independiente de Meta quedó implementado y validado. El PR permanece draft y no se promueve la aplicación ni se activa el cron hasta cargar la configuración oficial de Facebook Login for Business, autorizar la cuenta profesional de NexOps y ejecutar dos sincronizaciones reales. No se usaron datos ficticios como evidencia de Meta.
