# NexOps Ticketing

Aplicación multiempresa en Next.js para el portal de clientes y el backoffice operativo de NexOps.

## Estado del producto

El backend se selecciona de forma explícita:

- **Supabase:** se activa cuando están presentes las credenciales públicas y `SUPABASE_SERVICE_ROLE_KEY`.
- **Demo:** si falta alguna de esas credenciales, usa un JSON temporal en el directorio del sistema (`/private/tmp/nexops-ticketing-demo.json` en macOS).

No se mezclan datos de ambos modos durante una misma ejecución. El modo Supabase cubre autenticación, tickets, comentarios, historial, empresas, usuarios y adjuntos. El recorrido end-to-end y el aislamiento multiempresa todavía requieren validación manual contra un proyecto Supabase no productivo.

## Desarrollo local

Requisitos: Node.js compatible con Next.js 16 y npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

La aplicación se sirve sin `basePath`:

- login: `http://localhost:3000/portal/login`
- portal cliente: `http://localhost:3000/portal`
- backoffice: `http://localhost:3000/backoffice`
- diagnóstico de backend: `http://localhost:3000/setup`

Sin variables completas se inicia en modo demo. La contraseña demo está destinada exclusivamente al desarrollo local.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` es un secreto de servidor: nunca debe exponerse en variables `NEXT_PUBLIC_*`, logs ni clientes. `.env.local` permanece ignorado; `.env.example` documenta únicamente nombres y valores vacíos.

## Base de datos

Las migraciones versionadas están en `supabase/migrations/`:

1. `001_initial_schema.sql`: esquema, funciones, RLS y bucket privado.
2. `002_rls_hardening.sql`: endurecimiento de permisos para empresas, comentarios, adjuntos e historial.
3. `003_ticket_context_urls.sql`: hasta tres URLs de contexto por ticket.

No apliques estas migraciones directamente en producción sin revisar el historial del proyecto y probarlas primero en un entorno aislado. La exposición a Data API, los `GRANT`, las políticas efectivas y el estado real del bucket deben verificarse en Supabase; los archivos locales no demuestran por sí solos que estén aplicados.

## Validaciones

```bash
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

No hay todavía una suite automatizada. El recorrido manual recomendado está en `SUPABASE_MVP_CHECKLIST.md` y la auditoría de consolidación en `AUDITORIA_CONSOLIDACION.md`.

## Fuente de verdad

- checkout canónico: `/Users/alanfernandez/Desktop/nexops-tiketera`
- repositorio: `https://github.com/AlanTN13/nexopsticketera`
- rama canónica: `main`

La copia histórica del 26 de mayo de 2026 bajo `Documents/Codex` es anterior, no contiene Git y no debe usarse para desarrollo.
