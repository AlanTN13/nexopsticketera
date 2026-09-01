# EXECUTION RECEIPT — NexOps Contenido · Fase 1

Estado: EN EJECUCIÓN

## Trazabilidad

- Request canónico: `AlanTN13/Alanos#45`.
- Issue técnico: `AlanTN13/nexopsticketera#48`.
- Repo: `AlanTN13/nexopsticketera`.
- Branch: `codex/nexops-content-phase-1`.
- PR: pendiente de apertura como draft.
- Preview: pendiente.

## Technical Snapshot

- Base verificada: `main` en `7b008f9`.
- WIP remoto: sin otra implementación funcional activa; PR Dependabot #22 aislada.
- Stack: Next.js 16 App Router, Supabase Auth/Postgres, Vercel y módulos por empresa.
- Patrones reutilizados: `company_modules`, DAL `server-only`, Server Actions, cron autenticado, claims transaccionales y RLS por empresa.
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

- [ ] Issue técnico creado.
- [ ] PR draft abierto.
- [ ] Migración aditiva y reversible revisada.
- [ ] Entitlement y rutas del módulo.
- [ ] DAL y acciones autorizadas.
- [ ] Adaptador Meta server-only.
- [ ] Sync manual e idempotencia.
- [ ] Cron semanal condicionado al smoke real.
- [ ] Aislamiento A/B y secretos verificados.
- [ ] Tests, lint, typecheck y build.
- [ ] Preview READY y smoke.
- [ ] Acción externa Meta o evidencia real.

## Rollback

Deshabilitar el entitlement y el job detiene exposición y recolección. La migración es aditiva: ante defecto se conserva historial y se aplica forward-fix; no se ejecutan `DROP`, borrados ni backfills destructivos.

## Resultado final

Pendiente de validaciones y evidencia.
