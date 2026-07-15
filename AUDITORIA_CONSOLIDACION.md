# Auditoría y consolidación de NexOps Ticketing

> Documento histórico de la etapa 1. Los hallazgos de demo, cookie propia y uso amplio de `service_role` fueron abordados en `codex/harden-ticketing-v1`; consultar `ESTADO_ACTUAL.md` para el estado vigente.

Fecha: 2026-07-15

## Fuente de verdad

- Carpeta canónica: `/Users/alanfernandez/Desktop/nexops-tiketera`
- Repositorio: `https://github.com/AlanTN13/nexopsticketera.git`
- Rama base: `main`
- Rama de consolidación: `codex/consolidate-nexops-ticketing`
- Base auditada: `6641f0d`

Al comenzar, `main`, `origin/main` y el worktree coincidían. No había commits exclusivos locales o remotos, archivos modificados, nuevos o eliminados. Solo existía `origin/main`.

## Copias comparadas

Se comparó la fuente canónica con `/Users/alanfernandez/Documents/Codex/2026-05-26/quiero-hacer-una-tiketera-para-nexops` excluyendo `.next`, `node_modules`, `.env.local` y metadatos del sistema.

La copia histórica no tiene repositorio Git y corresponde a una etapa anterior. La versión canónica agrega autenticación y sesión, layouts protegidos, cola operativa, edición de empresas, backend Supabase, migraciones RLS y URLs de contexto, carga de adjuntos y documentación operativa. No se encontró código funcional exclusivo para rescatar. La copia histórica queda identificada para eliminación posterior, sin borrarla en esta consolidación.

## Estado funcional observado

### Portal cliente

- Autenticación: implementada en modo demo y con Supabase Auth.
- Dashboard, listado, filtros y alta de tickets: implementados.
- Detalle, comentarios externos e historial: implementados.
- Empresas: el cliente ve su contexto; la gestión global es interna.
- Usuarios: listado y alta según rol implementados.
- Invitaciones: se modelan como creación de usuario con contraseña; no existe un flujo completo por email, aceptación ni expiración.

### Backoffice NexOps

- Dashboard y métricas derivadas del snapshot: implementados.
- Cola multiempresa y filtros: implementados.
- Detalle de tickets, estados, prioridades, asignación y seguimiento: implementados.
- Empresas, usuarios internos y usuarios cliente: alta/edición implementadas.

### Supabase

- Auth: `signInWithPassword` para login; altas/ediciones administrativas usan `auth.admin`.
- Tablas: `companies`, `users`, `tickets`, `ticket_comments`, `ticket_attachments` y `ticket_history`.
- Relaciones, enums y constraints: versionados en migraciones.
- RLS: habilitado y endurecido por políticas versionadas.
- Aislamiento multiempresa: expresado en políticas y también filtrado en el servidor, pero falta una prueba negativa end-to-end contra dos tenants reales.
- Funciones: helpers de autorización (`current_app_user`, `is_internal_user`, `can_access_ticket`, `can_manage_company`, `can_manage_global_catalog`, `can_comment_on_ticket`).
- Storage: bucket privado y políticas versionadas; la aplicación sube y firma URLs mediante el cliente administrativo.
- Variables requeridas por la aplicación: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Hallazgos técnicos y de seguridad

1. El servidor carga snapshots y ejecuta mutaciones con `service_role`. Ese rol omite RLS, por lo que la seguridad efectiva de la aplicación depende de las comprobaciones de sesión/rol del servidor. Las políticas siguen siendo necesarias para accesos con JWT, pero hoy no son la barrera principal de los flujos server-side.
2. La sesión de aplicación no reutiliza la sesión JWT de Supabase. Se emite una cookie propia firmada con `SUPABASE_SERVICE_ROLE_KEY` y, en demo, con una contraseña constante. Conviene separar el secreto de sesión y evaluar SSR Auth oficial antes de V1.
3. El bootstrap desde `demoSeed` puede crear usuarios y datos cuando Supabase está activo y las tablas están vacías. Debe quedar explícitamente limitado a entornos de bootstrap/no productivos.
4. Las migraciones no contienen `GRANT` explícitos. La exposición efectiva a Data API debe verificarse según la configuración actual del proyecto Supabase.
5. No hay pruebas automatizadas ni fixtures de test separados del seed demo.
6. La generación del próximo código de ticket se calcula desde la aplicación y merece una prueba de concurrencia.
7. El README anterior describía un `basePath` inexistente y afirmaba que la operación seguía en demo, contradiciendo el código actual.
8. `.gitignore` ignoraba `.env.example`, impidiendo versionar el contrato de configuración.
9. La instalación limpia reporta tres vulnerabilidades moderadas: `js-yaml` transitivo y `postcss` incluido por Next.js. `npm audit` propone para Next un downgrade mayor incompatible, por lo que no se aplicó una corrección automática destructiva.

## Dependencias de modo demo

- `src/lib/demo-store.ts`: persiste en `path.join(tmpdir(), "nexops-ticketing-demo.json")`; en macOS normalmente resuelve a `/private/tmp/nexops-ticketing-demo.json`.
- `src/lib/demo-seed.ts`: empresas, usuarios, tickets, comentarios, adjuntos e historial hardcodeados.
- `src/lib/app-store.ts`: delega todas las operaciones al store demo cuando falta la configuración administrativa completa y usa el seed para bootstrap de Supabase vacío.
- `src/lib/auth.ts`: contraseña demo hardcodeada y secreto de cookie de fallback.
- `src/app/actions.ts`, `src/components/forms.tsx` y `src/app/setup/page.tsx`: login/reset/indicadores específicos de demo.

No se detectó uso de `localStorage`, `sessionStorage` ni otros JSON de persistencia. Para retirar demo faltan un modo de bootstrap seguro, configuración obligatoria por entorno, una estrategia de sesión Supabase SSR y pruebas equivalentes sobre una base aislada.

## Deuda para cerrar V1

- Validación manual completa con cuentas reales de al menos dos empresas y tres roles internos.
- Pruebas negativas de RLS/aislamiento y de visibilidad de comentarios internos.
- Confirmación de migraciones, grants, policies y bucket en un proyecto no productivo.
- Recuperación de contraseña e invitaciones por email.
- Secreto de sesión dedicado y estrategia para revocación/refresh.
- Pruebas automatizadas de autorización, mutaciones y concurrencia de códigos.
- Confirmar subida, reemplazo, lectura y eliminación de adjuntos con políticas de Storage.
- Retirar o bloquear bootstrap/demo en despliegues productivos.

## Consolidación aplicada

- Se corrigió `.gitignore` para mantener secretos ignorados y versionar `.env.example`.
- Se actualizó README para reflejar rutas, backend, variables, migraciones y límites reales.
- Se normalizó el nombre npm a `nexops-ticketing` en manifest y lockfile.
- Se eliminó estado React redundante del modal y tres imports muertos detectados por ESLint, sin cambiar funcionalidad.
- Se agregó este informe como registro versionado de la comparación y los pendientes.

## Validaciones de consolidación

- `npm ci`: correcto; 368 paquetes instalados desde lockfile.
- `npm run lint`: correcto.
- `npx tsc --noEmit --incremental false`: correcto.
- `npm run build`: correcto con Next.js 16.2.6.
- `git diff --check`: correcto.
- Smoke HTTP local: `/portal/login` responde 200; `/` y rutas protegidas redirigen según la sesión; `/backoffice` deriva a la cola.
- Suite automatizada: no existe en el repositorio.
- Recorrido autenticado con Supabase real: no ejecutado para evitar usar o modificar producción sin autorización y porque no hay un entorno de prueba identificado.
