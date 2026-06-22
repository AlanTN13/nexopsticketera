# Supabase MVP Checklist

## Qué quedó funcionando

- Cuando `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están presentes, la app usa Supabase como backend principal.
- El store demo deja de ser fallback silencioso si Supabase falla.
- El login real valida credenciales contra Supabase Auth.
- La sesión de la app queda persistida en una cookie firmada del servidor.
- Logout limpia la sesión de la app.
- Tickets, comentarios, empresas y usuarios siguen usando la misma UI, pero con Supabase como fuente principal cuando está configurado.
- Se endureció la validación server-side para:
  - evitar comentarios de `client_viewer`
  - evitar usuarios internos asociados a empresas cliente
  - evitar usuarios cliente sin empresa
- Se agregó una migración de RLS para alinear permisos de compañías, comentarios, adjuntos e historial con la lógica real del producto.
- Se agregó soporte de ticket para:
  - hasta 3 imágenes opcionales
  - hasta 3 URLs opcionales de contexto

## Checklist manual

### Setup

1. Confirmar que `.env.local` tenga las 3 variables de Supabase.
2. Aplicar las migraciones en la base, incluyendo:
   - `002_rls_hardening.sql`
   - `003_ticket_context_urls.sql`
3. Levantar la app con `npm run dev`.

### Empresas y usuarios

1. Ingresar como usuario interno `team_lead` o `platform_admin`.
2. Crear una empresa nueva desde `/backoffice`.
3. Confirmar que:
   - se crea la empresa en `companies`
   - se crea el admin inicial en `auth.users`
   - se crea el perfil en `public.users`
4. Entrar al detalle de la empresa.
5. Crear un usuario cliente adicional.
6. Editar un usuario cliente existente.
7. Ir a `/backoffice/users`.
8. Crear un usuario interno.
9. Confirmar que no se generan duplicados si falla la inserción del perfil.

### Login cliente

1. Ingresar con el admin cliente recién creado.
2. Confirmar redirección a `/portal`.
3. Refrescar la página.
4. Cerrar navegador o abrir nueva pestaña.
5. Confirmar persistencia de sesión mientras la cookie siga vigente.
6. Hacer logout y confirmar redirección a `/portal/login`.

### Tickets

1. Desde `/portal`, crear un ticket como `client_admin` o `client_operator`.
2. Confirmar que aparece en el listado del portal.
3. Entrar al detalle del ticket.
4. Confirmar que el ticket existe en `tickets`.
5. Confirmar que se creó evento de historial de creación en `ticket_history`.
6. Probar ticket con hasta 3 links opcionales.
7. Probar ticket con hasta 3 imágenes opcionales.
8. Confirmar que:
   - las URLs se ven en portal y backoffice
   - los adjuntos se ven en portal y backoffice

### Comentarios

1. Agregar un comentario externo como cliente con rol editor.
2. Confirmar persistencia en `ticket_comments`.
3. Ingresar como usuario interno.
4. Abrir el ticket desde `/backoffice/tickets/[ticketId]`.
5. Agregar un comentario interno.
6. Agregar un comentario externo.
7. Volver al portal como cliente.
8. Confirmar que:
   - ve el comentario externo
   - no ve el comentario interno

### Workflow interno

1. Desde backoffice, cambiar:
   - estado
   - prioridad
   - asignado
2. Confirmar persistencia en `tickets`.
3. Confirmar eventos de historial correspondientes.
4. Confirmar que el portal refleja esos cambios tras refresh.

### Permisos multiempresa

1. Ingresar con un usuario cliente de empresa A.
2. Confirmar que solo ve tickets de empresa A.
3. Confirmar que solo ve usuarios de empresa A.
4. Ingresar con un usuario cliente de empresa B.
5. Confirmar aislamiento total respecto de empresa A.
6. Ingresar con `client_viewer`.
7. Confirmar que:
   - puede ver tickets de su empresa
   - no puede crear tickets
   - no puede comentar
   - no puede invitar usuarios

## Pendientes conocidos

### Adjuntos

- El schema, bucket y policies base ya existen.
- No cerré upload real desde UI en este paso para no meter riesgo extra en el MVP.
- Antes de habilitarlo conviene definir:
  - flujo de subida
  - creación del registro `ticket_attachments`
  - sincronización con `storage.objects`
  - descarga segura por policy

### Recuperación de contraseña

- La UI actual sigue derivando a soporte por mail.
- No agregué flujo visual nuevo de reset para no abrir superficie extra antes de cerrar el MVP core.
- Si se quiere cerrar después, lo ideal es usar el flujo nativo de recuperación de Supabase Auth.

### Lint

- `npm run lint` no pudo validarse por un problema de dependencias del entorno:
  - `Cannot find module './item.js'`
  - originado dentro de `@babel/core` / `eslint-config-next`
- `npm run build` sí pasó correctamente.
