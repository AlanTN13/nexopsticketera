# NexOps Ticketing

Aplicación `Next.js` para una tiketera multiempresa orientada a clientes de NexOps y a su equipo interno.

## Qué incluye

- Portal cliente con dashboard, filtros y alta de tickets.
- Backoffice con cola operativa, asignación y cambio de workflow.
- Historial y comentarios internos/externos.
- Gestión simple de usuarios por empresa y directorio global.
- Modo demo persistente en `/private/tmp/nexops-ticketing-demo.json`.
- Base lista para Supabase con migración inicial en `supabase/migrations/001_initial_schema.sql`.

## Desarrollo

```bash
npm run dev
```

La app está configurada con `basePath: "/portal"`, así que en desarrollo se abre desde `http://localhost:3000/portal`.

Abrí la home del portal y elegí una de las personas demo para navegar distintos permisos.

## Variables de entorno

Copiá `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Estado actual

La app ya puede autenticarse con Supabase Auth cuando existen las variables de entorno.

La operación de tickets, comentarios, empresas y usuarios sigue funcionando sobre el store demo persistente. Para pasar al backend real todavía falta reemplazar ese store por consultas/mutaciones de Supabase Postgres + Storage.
