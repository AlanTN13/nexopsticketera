# EXECUTION RECEIPT — Portal NexOps: módulos y permisos V2

Estado: `VALIDATED` — código, migración productiva autorizada, harness SQL/RLS transaccional y regresión de datos verdes

Fecha de inicio: 2026-09-01

Issue de origen: `AlanTN13/Alanos#46`

Repo técnico: `AlanTN13/nexopsticketera`

Branch: `codex/company-module-access-v2`

Issue técnico: `AlanTN13/nexopsticketera#51`

PR draft: `AlanTN13/nexopsticketera#52`

Commit revisado: `8638458a6f80b4cf21b157e2cfde8a355e711b25`

## WIP y alcance

- Se ejecuta únicamente la base transversal de módulos y permisos de `Alanos#46`.
- `Alanos#45` / Contenido–Instagram queda en espera. Su worktree y PR draft existentes no se modifican.
- Alan autorizó usar la base productiva como único entorno para evitar el costo de una branch. No se cambiaron credenciales.

## TECHNICAL SNAPSHOT

- Stack: Next.js 16 App Router, React 19, Supabase Auth/SSR/Postgres/RLS, Vercel.
- Baseline integrada: `origin/main@b334da0a89d8d90cce7d6eb39bcd0e5bbb0635fe`.
- Modelo vigente: identidad única en `auth.users` + `public.users`; rol base; empresa única para clientes; usuarios internos sin empresa; `company_modules` sólo para `metrics` y `radar`; Soporte implícito; internos con acceso global por rol.
- Autorización vigente: helpers TypeScript y funciones `private.*` de Postgres. La navegación oculta módulos, pero no existe permiso por usuario/módulo ni asignación interna por empresa.
- Tests: Vitest con tests de autorización, migraciones y aislamiento; lint, typecheck y build.
- Riesgo principal: IDOR/BOLA por mantener el helper histórico que trata a todo usuario interno como global.

## DELIVERY DESIGN

Resultado y usuario:

- Un administrador autorizado de NexOps administra módulos por empresa, niveles por usuario y empresas atendidas por cada integrante interno. La UI explica el acceso efectivo antes de guardar.

Tipo / tamaño / riesgo:

- `T3 / L / R3` por autorización transversal, RLS, migración compatible y radio sobre Soporte, Métricas y Radar.

Restricciones y no-objetivos:

- Sin facturación, planes comerciales, roles personalizados, SSO, usuarios cliente multiempresa ni implementación de Contenido/Instagram.
- Sin nueva sesión, servicio o sistema paralelo de autorización.
- Sin decisiones basadas en `user_metadata`; `public.users` y las tablas de acceso son fuente operativa.

Alternativas consideradas:

- `A0`: sólo extender roles existentes. Rechazada: produciría combinaciones de roles y no resuelve empresa + módulo + nivel.
- `A1`: agregar tablas de asignación y helpers sobre el modelo actual. Elegida para persistencia y migración.
- `A2`: centralizar cálculo de acceso efectivo en un contrato compartido TypeScript/SQL. Elegida porque ya existen múltiples consumidores reales: navegación, páginas, Server Actions, queries y RLS.
- `A3`: servicio de autorización separado. Rechazada: complejidad operativa sin necesidad.

Decisión arquitectónica:

- Catálogo `portal_modules` con claves estables (`support`, `metrics`, `radar`, `content`) y metadata de presentación.
- `company_modules` conserva settings y pasa a representar todos los módulos, incluido Soporte.
- `user_company_assignments` limita las empresas de usuarios internos. `platform_admin` mantiene override global explícito.
- `user_module_permissions` asigna `view`, `operate` o `admin` por usuario, empresa y módulo.
- El acceso efectivo exige: usuario activo + empresa accesible + módulo habilitado + permiso suficiente. `platform_admin` conserva acceso global explícito, siempre sujeto a que el módulo esté habilitado para la empresa.
- `access_audit_log` registra actor, empresa, usuario/módulo afectados, valor anterior/nuevo, acción, motivo y timestamp. Triggers cubren también escrituras directas autorizadas.
- Los clientes siguen vinculados a una sola empresa. El control plane queda reservado a `platform_admin`: `team_lead`, `client_admin` y el nivel funcional `admin` no habilitan productos, asignan empresas ni conceden niveles.
- `private.can_access_company` resuelve sólo tenant/asignación. Un helper separado exige además módulo habilitado y nivel; RLS, Storage y cada RPC de negocio usan ese segundo contrato.
- Server Actions vuelven a autenticar la sesión y delegan la mutación en RPCs transaccionales. La UI nunca es la autoridad.

Reglas configurables vs. invariantes:

- Configurable: módulos habilitados, asignaciones internas, nivel por usuario/módulo, settings propios del módulo.
- Invariantes: cliente en una sola empresa; jerarquía `view < operate < admin`; `admin` no administra el control plane; módulo deshabilitado anula todo permiso; usuario inactivo no accede; sólo `platform_admin` es global; cambios de acceso se auditan.

Datos y migración:

- Migración expand-only, aditiva y compatible: crear catálogo/tablas/índices/policies/helpers; quitar el check enumerado de `company_modules`; sembrar filas para todos los módulos/empresas. El backfill usa conflictos controlados, pero la migración completa se ejecuta una sola vez por entorno.
- Backfill compatible: Soporte habilitado para todas las empresas; se preservan settings y flags de Métricas/Radar; clientes reciben `view/operate/admin` según su rol base en módulos hoy habilitados; internos activos existentes reciben asignaciones a empresas actuales y sólo permisos de Soporte (`agent=operate`, `team_lead=admin`) para no expandir privilegios; futuros internos nacen sin empresas; `platform_admin` no necesita filas.
- Las RLS de tickets, comentarios, adjuntos, historial y Storage pasan a exigir `support` y el nivel correspondiente. Las RPC existentes se revalidan dentro de la transacción; los checks de UI/Server Action son defensa adicional.
- No hay eliminación de datos ni de columnas en esta entrega.

Plan de validación:

- Tests unitarios de cálculo efectivo y jerarquía.
- Tests estáticos/contractuales de migración, grants, RLS, triggers y auditoría.
- Matriz A/B para cliente e interno asignado/no asignado.
- Acceso directo por URL, Server Action manual, ID de otra empresa y escalamiento de nivel.
- Regresión Soporte/Métricas/Radar, invitación/login y usuarios inactivos.
- Lint, typecheck, suite completa, build, preview Vercel y smoke autenticado en entorno seguro si existen identidades/datos no productivos.
- Revisión independiente de auth/RLS/migración antes del cierre.

Rollout / rollback:

- Rollout: aplicar migración sólo en branch/local o preview seguro; desplegar app; ejecutar smoke por roles; recién después solicitar gate productivo.
- Rollback lógico fail-closed: deshabilitar la UI nueva y conservar RLS estricta, tablas y backfill sin pérdida. Nunca restaurar el helper global histórico.
- Recuperación previa a producción: revertir la aplicación y mantener el control de datos restrictivo; cualquier ajuste SQL debe preservar asignaciones y módulo/nivel. No se ejecuta automáticamente.

Triggers de evolución futura:

- `Contenido` se incorpora al catálogo y usa el mismo permiso; no se permiten excepciones por workspace o persona.
- Permisos por acción más granulares sólo si aparecen acciones reales que no puedan mapearse a `view/operate/admin`.

## CAPACITY PLAN

- Contexto cargado: issue #46, WIP vigente, auth/RLS/migraciones, rutas Server Component/Actions, tests y despliegue.
- Planificación suficiente cuando: tablas, invariantes, backfill, fronteras de agentes, pruebas y rollback están fijados.
- Equipo: Director como integrador/escritor principal; especialista independiente de datos/seguridad para challenge y review; QA independiente para matriz adversarial y smoke.
- Checks focalizados: tests de autorización/migración/UI por cada vertical.
- Checks globales centralizados: suite, lint, typecheck y build una vez integrada la superficie.
- Headroom: reservar correcciones posteriores al review y al preview.
- `BUDGET_RISK`: aparece sólo si el modelo vigente impide un backfill compatible o el preview carece de entorno seguro verificable.

## CHECKPOINT

```text
EXECUTION CHECKPOINT
Proyecto / resultado: Portal NexOps — módulos y permisos V2
Estado: VALIDATED
Repo / branch / PR: AlanTN13/nexopsticketera / codex/company-module-access-v2 / #52 draft
Última evidencia: commit 8638458; migraciones productivas 20260901102427 y 20260901102729; harness A/B PASS con ROLLBACK
Validaciones: diff-check, lint, typecheck, 36 archivos/156 tests, build webpack, QA/security review y regresión de datos reales
Bloqueos: ninguno para cerrar #46
Siguiente movimiento: integrar #52 y retomar #45 sobre este contrato, sin hardcodes
```

## Validaciones ejecutadas

- `git diff --check`: `PASS`.
- ESLint: `PASS`.
- TypeScript `tsc --noEmit --incremental false`: `PASS`.
- Vitest: `PASS` — 36 archivos, 156 tests.
- Next.js production build con webpack: `PASS`.
- GitHub Actions `verify`: `PASS` sobre `bea3a76`.
- Vercel `nexopsticketera`: `PASS` — preview `https://nexopsticketera-git-co-e32fb5-alan-fernandezs-projects-f6e1f457.vercel.app` (SSO protegido).
- Vercel `sdnexops`: `PASS` — preview `https://sdnexops-git-codex-com-3f3d82-alan-fernandezs-projects-f6e1f457.vercel.app` (SSO protegido).
- Revisión QA independiente: `READY_CODE`, sin bloqueos de implementación.
- Revisión independiente auth/RLS: `READY`, sin P0/P1 abiertos.
- Gate productivo explícito: `PASS` — Alan indicó usar la base productiva y no crear una branch con costo.
- Migración `company_module_access_v2`: `PASS` — aplicada atómicamente en Supabase productivo.
- Primer harness dinámico: `FAIL SAFE` — detectó que el trigger de actividad de comentarios podía confundirse con un cambio de workflow; la transacción completa se revirtió.
- Corrección forward-only `allow_comment_ticket_touch`: `PASS` — compara columnas de negocio explícitamente y mantiene `updated_at` fuera del workflow.
- Segundo harness `supabase/tests/module_access_v2_rls.sql`: `PASS` — aislamiento A/B, niveles, usuario inactivo, módulo apagado, RPC, DML, Storage y auditoría; terminó con `ROLLBACK`.
- Regresión productiva: `PASS` — 0 fixtures residuales; 3 empresas y 5 usuarios preservados; settings de Métricas/Radar sin cambios; Soporte habilitado para las tres empresas; Contenido deshabilitado para todas; agente existente asignado sólo a Soporte; historial 78 externo / 1 interno.
- Asesores Supabase revisados: sin hallazgo nuevo que invalide el gate. Los avisos `SECURITY DEFINER` corresponden a RPCs autenticadas con autorización interna y grants mínimos; los avisos de índices son informativos y no alteran el aislamiento.

## Resultado final

- Entrega implementada en PR draft: catálogo de módulos; módulos por empresa; permisos por usuario/empresa/módulo con jerarquía `view/operate/admin`; asignaciones internas por empresa; auditoría inmutable; UI de administración; autorización centralizada; RLS/Storage/RPC/triggers; migración/backfill y runbook.
- Las rutas y acciones de Soporte, Métricas y Radar consumen el mismo contrato. Radar y Métricas requieren empresa explícita para actores internos; Soporte deja de otorgar acceso global por el mero rol interno.
- Los accesos directos quedan cubiertos contractualmente y por harness: tenant A/B, ID ajeno, DML directo, RPC, nivel insuficiente, módulo deshabilitado, usuario inactivo, notas/adjuntos/historial internos, responsable interno y Storage owner/delete.
- Los adjuntos se sirven mediante un endpoint autenticado que revalida RLS por request y emite una URL firmada de 30 segundos.
- La entrega queda `VALIDATED`; el gate dinámico y la migración productiva fueron ejecutados con autorización explícita y evidencia de recuperación transaccional.
- `Alanos#45` puede retomarse. Contenido/Instagram debe usar la clave `content`, la misma jerarquía y las mismas asignaciones, sin excepción ni hardcode para NexOps.

## Knowledge Delta propuesto

- El contrato transversal de autorización es `usuario activo + empresa propia/asignada + módulo habilitado + nivel suficiente`.
- `platform_admin` sustituye asignación y permiso personal, pero no el entitlement de empresa; un módulo deshabilitado falla cerrado para todos.
- Los niveles funcionales no conceden control comercial. Sólo `platform_admin` administra módulos, asignaciones y permisos.
- Cualquier módulo nuevo —incluido Contenido— debe integrarse al catálogo, helpers, UI, RLS/RPC y matriz A/B. No se aceptan rutas, usuarios o workspaces privilegiados por hardcode.
