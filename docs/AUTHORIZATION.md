# Autenticación, roles y privilegios

## Sesión

`@supabase/ssr` almacena access y refresh tokens en cookies. `src/proxy.ts` llama `getClaims()` para validar/refrescar el JWT y propagar cookies; el servidor usa `getUser()` cuando necesita identidad actual. No se usa `getSession()` para autorizar y no existe una cookie de identidad propia.

## Flujo normal

`getSupabaseServerClient()` crea un cliente Data API con la clave publicable y las cookies de la solicitud. Supabase recibe el JWT del usuario; grants determinan operaciones disponibles y RLS limita filas. Las validaciones TypeScript mejoran errores y UX, pero no reemplazan RLS.

## Roles

- `client_viewer`: lectura dentro de su empresa.
- `client_operator`: lectura, tickets y comentarios externos dentro de su empresa.
- `client_admin`: lo anterior más gestión de perfiles de su empresa.
- `agent`: operación multiempresa de tickets.
- `team_lead`: operación y catálogo global.
- `platform_admin`: administración completa prevista por la V1.

La constraint `users_role_company_consistency` impide perfiles internos asociados a una empresa y perfiles cliente sin empresa.

## service_role

El cliente elevado está en `src/lib/supabase-server.ts`, marcado `server-only`. Sus usos permitidos quedan enumerados:

1. `auth.admin.createUser`: Supabase Auth no permite a un usuario normal crear otra cuenta con contraseña sin cambiar su propia sesión.
2. `auth.admin.updateUserById`: sincroniza email, contraseña y metadatos de una cuenta administrada.
3. NexOps Contenido: persiste tokens de Meta cifrados, reclama corridas idempotentes y escribe snapshots historizados. Cada operación deriva empresa y workspace de la sesión o de una fila programada ya autorizada; nunca acepta un `company_id` del navegador.

Las inserciones/actualizaciones de `public.users` que acompañan esas operaciones usan el cliente de la sesión y RLS. Fuera del subsistema server-only de Contenido, `service_role` no se usa para snapshots, tickets, comentarios, historial, empresas, métricas o Storage.

Las tablas `content_meta_credentials` y `content_meta_oauth_states` no otorgan ningún privilegio a `authenticated`: los tokens cifrados y los estados OAuth nunca se serializan hacia componentes cliente. Las tablas de inventario e historial sí tienen lectura RLS por empresa y entitlement activo.

El rol se guarda en `app_metadata` como referencia de Auth y en `public.users` como fuente operativa protegida. Nunca se toma `user_metadata` como dato de autorización.

## Invitaciones

La UI llama “crear usuario” a un alta directa y confirma el email administrativamente. No hay invitación aceptable por enlace, expiración ni recuperación de contraseña. Implementarlas es un alcance posterior.

## Controles de base

- `anon` queda sin grants de negocio.
- `authenticated` recibe grants por operación y, para updates sensibles, por columna.
- Todas las policies declaran `TO authenticated` y predicados de tenant/rol.
- Helpers RLS viven en `private`, fijan `search_path = ''` y evitan recursión sobre `public.users` mediante `security definer` controlado.
- Storage deriva el ticket del path y valida empresa/rol antes de leer, insertar o borrar.
