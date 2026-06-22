# Estado actual de NexOps Tiketera

## Resumen ejecutivo

NexOps Tiketera ya no está en un estado híbrido improvisado.

Hoy el repo quedó preparado para trabajar así:

- con variables de Supabase completas: `Supabase` es el backend principal
- sin variables completas: la app cae a `modo demo`
- se evita el estado intermedio donde unas cosas viven en Supabase y otras en el JSON local

Además, la base de Supabase del proyecto actual ya tiene:

- esquema inicial aplicado
- migración adicional de endurecimiento RLS aplicada
- seed inicial cargado
- usuarios reales en `auth.users` y `public.users`

## Qué ya quedó hecho

### Backend y persistencia

- Se centralizó la decisión de backend en [`src/lib/backend.ts`](/Users/alanfernandez/Desktop/nexops-tiketera/src/lib/backend.ts).
- Si existe configuración admin de Supabase, la app opera en modo `supabase`.
- Si falta `SUPABASE_SERVICE_ROLE_KEY`, la app cae a demo con warning explícito para evitar un backend híbrido.
- El store demo dejó de ser fallback silencioso cuando Supabase está activo.
- El bootstrap inicial desde el seed demo hacia Supabase quedó más tolerante e idempotente.

### Auth y sesión real

- El login usa `Supabase Auth` cuando el backend principal es Supabase.
- La sesión de la app se guarda en una cookie firmada del servidor: `nexops_session`.
- Se limpió la cookie legacy anterior.
- La sesión incluye modo de backend para invalidar sesiones inconsistentes entre demo y Supabase.
- Logout ya limpia correctamente la sesión.

### Seguridad server-side

- Todas las acciones mutantes validan que el `actorId` enviado por formulario coincida con la sesión autenticada del servidor.
- `client_viewer` no puede comentar.
- Se endureció la validación de creación/edición de usuarios para evitar:
  - usuarios internos asociados a empresas cliente
  - usuarios cliente sin empresa
  - asignaciones de rol incompatibles

### Tickets, comentarios e historial

- La UI actual de portal y backoffice se mantiene.
- Tickets, comentarios, historial, empresas y usuarios leen desde Supabase cuando está activo.
- El detalle de ticket en portal ya no muestra el formulario de comentario para roles sin permiso.
- El historial y los comentarios siguen el formato que la UI ya espera.
- El alta de ticket ya acepta:
  - hasta 3 imágenes opcionales
  - hasta 3 URLs opcionales de contexto

### Base de datos y RLS

- Ya estaba la migración base: [`supabase/migrations/001_initial_schema.sql`](/Users/alanfernandez/Desktop/nexops-tiketera/supabase/migrations/001_initial_schema.sql)
- Se agregó y aplicó la migración: [`supabase/migrations/002_rls_hardening.sql`](/Users/alanfernandez/Desktop/nexops-tiketera/supabase/migrations/002_rls_hardening.sql)

La segunda migración ajusta especialmente:

- permisos de compañías
- inserción de comentarios
- inserción de historial
- inserción de adjuntos
- funciones auxiliares de autorización

## Base de Supabase validada

Sobre el proyecto actual de Supabase:

- el esquema `public` quedó creado correctamente
- existen las tablas principales:
  - `companies`
  - `users`
  - `tickets`
  - `ticket_comments`
  - `ticket_attachments`
  - `ticket_history`
- quedaron aplicadas policies de RLS para lectura y escritura alineadas al producto
- el seed cargó usuarios operativos reales para pruebas

Usuarios seed detectados:

- `laura@nexmart.com` (`client_admin`)
- `mateo@nexmart.com` (`client_operator`)
- `ana@saludplus.io` (`client_viewer`)
- `santiago@nexops.io` (`agent`)
- `camila@nexops.io` (`team_lead`)
- `info@nexopstech.com` (`platform_admin`)

## Validaciones ya hechas

- `npm run build` pasó correctamente.
- La app levanta con `npm run dev`.
- La raíz `/` redirige al login y la pantalla `/portal/login` responde bien.
- La base ya no quedó vacía ni rota por duplicados del seed.

## Entregables ya creados

- Estado general actualizado: [`ESTADO_ACTUAL.md`](/Users/alanfernandez/Desktop/nexops-tiketera/ESTADO_ACTUAL.md)
- Checklist manual MVP: [`SUPABASE_MVP_CHECKLIST.md`](/Users/alanfernandez/Desktop/nexops-tiketera/SUPABASE_MVP_CHECKLIST.md)
- Nueva migración RLS: [`supabase/migrations/002_rls_hardening.sql`](/Users/alanfernandez/Desktop/nexops-tiketera/supabase/migrations/002_rls_hardening.sql)
- Nueva migración para URLs del ticket: [`supabase/migrations/003_ticket_context_urls.sql`](/Users/alanfernandez/Desktop/nexops-tiketera/supabase/migrations/003_ticket_context_urls.sql)

## Lo que todavía falta cerrar

Esto es lo pendiente real, no cosmético:

1. Validar end-to-end con login real en navegador:
   - portal cliente
   - backoffice interno
   - creación de ticket
   - comentarios internos y externos
   - cambios de workflow

2. Terminar de confirmar permisos multiempresa en pruebas manuales:
   - empresa A no ve empresa B
   - cliente no ve comentarios internos
   - `client_viewer` no puede operar

3. Adjuntos:
   - ya quedó cerrada una subida básica de hasta 3 imágenes por ticket
   - falta validar en entorno real después de aplicar la migración nueva

4. Recuperación de contraseña:
   - no se abrió una UI nueva
   - queda pendiente, salvo que se decida usar directamente el flujo nativo de Supabase Auth

5. Lint del entorno:
   - `npm run lint` sigue trabado por dependencias del entorno
   - `npm run build` sí valida el proyecto

## Conclusión

La parte más delicada ya está encaminada:

- Supabase quedó como fuente principal cuando está configurado
- el modo demo queda como fallback explícito
- se endurecieron sesión, permisos y RLS
- la base ya está migrada y sembrada

Lo que sigue ahora ya no es “armar la arquitectura”, sino terminar la validación funcional punta a punta y cerrar los últimos bordes del MVP real.
