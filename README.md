# NexOps Ticketing

Ticketera multiempresa en Next.js 16 con Supabase como único backend de ejecución.

## Arquitectura V1

- Supabase Auth con sesión SSR en cookies gestionadas por `@supabase/ssr`.
- Postgres y Data API bajo la identidad JWT del usuario autenticado.
- RLS como barrera principal de aislamiento entre empresas.
- Storage privado para adjuntos, también protegido por RLS.
- `service_role` limitado a creación y actualización explícita de cuentas en `auth.admin`.
- Sin JSON local, contraseña demo, seed automático ni fallback silencioso.

Más detalle: `docs/AUTHORIZATION.md`.

## Configuración

Requisitos: Node.js 20/22/24+, npm y un proyecto Supabase no productivo para desarrollo.

```bash
npm ci
cp .env.example .env.local
```

Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

La clave publicable puede estar en el frontend y queda limitada por grants y RLS. `SUPABASE_SERVICE_ROLE_KEY` es server-only y solo es necesaria para crear o editar usuarios desde acciones administrativas. Nunca debe llevar prefijo `NEXT_PUBLIC_`.

La variable legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` sigue aceptada durante la migración, pero los proyectos nuevos deben usar la clave publicable.

## Base de datos local o staging

Las migraciones viven en `supabase/migrations/`. Para una base vacía se aplican en orden; la migración `harden_ticketing_v1` reemplaza las políticas antiguas, agrega grants explícitos, helpers privados con `search_path` fijo, constraints, índices y generación atómica de códigos.

No ejecutes comandos de link/push/reset contra producción. En un proyecto local o staging identificado:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

Luego seguí `SUPABASE_MVP_CHECKLIST.md`. Este repositorio no incluye seed automático. Las cuentas y empresas de staging se crean deliberadamente para las pruebas y se eliminan según la política del entorno.

## Desarrollo

```bash
npm run dev
```

- Login: `http://localhost:3000/portal/login`
- Portal: `http://localhost:3000/portal`
- Backoffice: `http://localhost:3000/backoffice`
- Diagnóstico: `http://localhost:3000/setup`

Si Supabase no está configurado, la aplicación falla explícitamente. No existe modo demo.

## Validaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
npm audit
```

Las pruebas locales cubren roles, rutas protegidas a nivel de autorización, aislamiento A/B, IDs directos, comentarios, workflow y métricas. Las políticas reales deben validarse adicionalmente sobre Supabase local o staging.

## Piloto y preparación productiva

El proyecto `tfonsiurhjmllqaknhgh` es la única base de desarrollo, piloto interno y producción futura. La limpieza de datos temporales no es automática y requiere autorización explícita. Consultar:

- `docs/INTERNAL_PILOT.md` para operar el piloto controlado;
- `docs/PREPRODUCTION_CLEANUP.md` para inventario, backup, clasificación, limpieza y smoke test preproducción.

## Invitaciones

La V1 conserva creación administrativa directa con contraseña y `email_confirm`. No existe todavía aceptación por email, expiración de invitaciones ni recuperación visual de contraseña. Es deuda explícita y no debe presentarse como un flujo de invitación completo.

## Fuente de verdad

- Local: `/Users/alanfernandez/Desktop/nexops-tiketera`
- GitHub: `https://github.com/AlanTN13/nexopsticketera`
- Rama canónica: `main`
