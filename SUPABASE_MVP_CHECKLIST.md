# Checklist de validación Supabase V1

Ejecutar únicamente en Supabase local o staging identificado. Nunca usar producción como entorno de prueba.

## Preparación

1. Confirmar por project ref y propietario que el entorno no es producción.
2. Revisar `npx supabase migration list` y `npx supabase db push --dry-run`.
3. Aplicar migraciones con el procedimiento aprobado del entorno.
4. Ejecutar Database Linter/Security Advisor.
5. Confirmar que `.env.local` usa URL y publishable key de staging.
6. Crear deliberadamente Empresa A, Empresa B, un cliente de cada una y usuarios internos NexOps. No hay seed automático.

## Data API y base

- `anon` no tiene acceso a tablas de negocio.
- `authenticated` tiene solo los grants declarados en la migración V1.
- RLS está activa en las seis tablas públicas.
- Las funciones de autorización viven en `private`, son `security definer`, fijan `search_path = ''` y no son ejecutables por `anon`/`public`.
- Los perfiles cumplen la consistencia rol/empresa.
- El código de ticket se genera de forma única mediante `ticket_code_seq`.

## Aislamiento A/B

- Cliente A ve empresa, usuarios, tickets, comentarios externos, historial y adjuntos de A.
- Cliente A no puede leer ni modificar recursos de B, incluso consultando IDs directos.
- Cliente B no puede leer comentarios o adjuntos de A.
- `client_viewer` no crea tickets ni comentarios.
- Un cliente no crea comentarios internos ni accede al backoffice.
- Agente NexOps ve la operación multiempresa y actualiza workflow, pero no administra catálogo global.
- `team_lead` y `platform_admin` administran empresas y usuarios según el modelo documentado.

## Storage

- El bucket `ticket-attachments` es privado.
- Un cliente editor puede subir y leer adjuntos de su ticket.
- Un viewer puede leer adjuntos visibles pero no subirlos.
- Ningún cliente puede leer, escribir o borrar objetos de otra empresa alterando el path.
- Las URLs firmadas se emiten bajo la sesión del usuario.

## Flujos manuales

### Portal

- Login y refresh de sesión.
- Dashboard, filtros y listado.
- Alta de ticket con links y adjuntos.
- Detalle, comentario externo e historial.
- Directorio de usuarios según rol.
- Logout y rechazo posterior de rutas protegidas.

### Backoffice

- Login interno y rechazo para clientes.
- Métricas y cola multiempresa.
- Detalle, estado, prioridad y asignación.
- Comentarios internos/externos.
- Alta/edición de empresas y usuarios.

## Producción pendiente

Después de aprobar staging, comparar sin aplicar: historial de migraciones, grants, RLS, funciones, `search_path`, Security Advisor, bucket/policies, URLs Auth y variables del despliegue. Toda aplicación productiva requiere autorización separada.
