# Plan de limpieza preproducción

## Alcance y autorización

El proyecto Supabase `tfonsiurhjmllqaknhgh` es la única base de desarrollo, piloto interno y producción futura de la Ticketera NexOps. No se crea ni se promueve otro proyecto.

Este documento es un runbook. Ejecutarlo requiere una autorización explícita posterior que identifique la ventana de mantenimiento, el responsable que aprueba la conservación y eliminación de cada usuario, la identidad del administrador real y la política elegida para la numeración de tickets.

Hasta recibir esa autorización no se borran filas, usuarios Auth, sesiones ni objetos de Storage. Tampoco se usa `TRUNCATE`, `DROP`, `CASCADE` o un reset de base.

## Principios de seguridad

1. Congelar altas y pruebas durante la ventana de limpieza.
2. Obtener y verificar backups antes de mutar datos.
3. Clasificar por identificadores explícitos, no solamente por fechas.
4. Preparar listas aprobadas de conservación y eliminación.
5. Eliminar primero objetos y datos dependientes; eliminar Auth al final.
6. Conservar esquema, migraciones, grants, RLS, funciones, triggers, índices y bucket.
7. Registrar conteos y checksums antes y después.
8. Abortarlo si aparece un registro no clasificado.

## Fase 0: inventario congelado

Registrar fecha UTC, commit desplegado, operador y project ref. Exportar a CSV o JSON, sin contraseñas ni tokens:

- `auth.users`: id, email, fechas, proveedor, confirmación y `app_metadata`;
- `public.companies`;
- `public.users`;
- `public.tickets`;
- `public.ticket_comments`;
- `public.ticket_history`;
- `public.ticket_attachments`;
- `storage.buckets` y `storage.objects`;
- `supabase_migrations.schema_migrations`;
- valor de `public.ticket_code_seq`.

Conteos mínimos:

```sql
select 'auth.users' as entity, count(*) from auth.users
union all select 'companies', count(*) from public.companies
union all select 'users', count(*) from public.users
union all select 'tickets', count(*) from public.tickets
union all select 'ticket_comments', count(*) from public.ticket_comments
union all select 'ticket_history', count(*) from public.ticket_history
union all select 'ticket_attachments', count(*) from public.ticket_attachments
union all select 'storage.objects', count(*) from storage.objects;
```

## Fase 1: backup completo y verificable

### PostgreSQL

Crear un dump lógico en formato custom de `public`, `auth` y `storage`. Guardar fuera del repositorio el archivo, timestamp UTC, tamaño, SHA-256, salida de `pg_restore --list`, versión de `pg_dump` y project ref. No registrar la URL de conexión o contraseña.

### Storage

Los backups de PostgreSQL contienen metadatos de Storage, no los binarios. Por eso se debe generar además:

1. manifiesto con bucket, path, tamaño, MIME type, fecha y owner;
2. descarga de cada objeto a un directorio cifrado fuera del repositorio;
3. checksum SHA-256 por archivo;
4. comparación entre manifiesto, archivos y `storage.objects`;
5. prueba de lectura de una muestra.

La limpieza no comienza si falta un objeto o si algún checksum no coincide.

## Fase 2: clasificación de datos

### Indicadores conocidos de prueba

- emails `staging.*@example.invalid`;
- `user_metadata.staging_test = true`;
- slugs `staging-a-*` o `staging-b-*`;
- nombres que comienzan con `Staging Empresa`;
- tickets relacionados con esas empresas y usuarios;
- comentarios, historial, adjuntos y objetos de esos tickets.

Estos marcadores generan candidatos, no una autorización automática de borrado.

Cada registro debe quedar en una planilla aprobada como `KEEP_REAL_ADMIN`, `KEEP_PILOT`, `DELETE_TEST` o `REVIEW`. Si existe al menos un `REVIEW`, la limpieza se detiene.

La clasificación debe seguir relaciones:

```text
company
├── profiles
└── tickets
    ├── comments
    ├── history
    ├── attachment metadata
    └── Storage objects
```

## Fase 3: administrador real

Antes de retirar el último administrador existente:

1. recibir nombre y email corporativo reales;
2. crear la cuenta mediante la operación administrativa server-side;
3. establecer `app_metadata.role = platform_admin`;
4. crear `public.users` con `company_id = null`, rol `platform_admin` y estado `active`;
5. confirmar email según la política Auth aprobada;
6. entregar contraseña fuerte por canal seguro;
7. validar login, backoffice y logout;
8. conservar un segundo mecanismo de recuperación administrativa.

No se embeben email, UUID o contraseña del administrador en seeds o migraciones.

## Fase 4: eliminación controlada

Preparar primero un reporte dry-run con IDs y conteos. Tras aprobación, ejecutar en una ventana sin usuarios conectados:

1. revocar sesiones de usuarios `DELETE_TEST`;
2. eliminar binarios de Storage aprobados;
3. verificar que no se incluyan paths de tickets conservados;
4. eliminar metadatos de adjuntos;
5. eliminar historial;
6. eliminar comentarios;
7. eliminar tickets;
8. eliminar perfiles;
9. eliminar empresas;
10. eliminar usuarios Auth mediante Admin API;
11. comprobar referencias huérfanas.

Las eliminaciones SQL se ejecutan en una transacción con `lock_timeout` y `statement_timeout` conservadores. No se usa `CASCADE` como sustituto de una lista revisada. Storage y Auth no comparten la transacción SQL: cada fase necesita checkpoint y log propio.

## Fase 5: secuencia de tickets

Decisión requerida:

- **reiniciar** si no se conserva ningún ticket y el primer ticket real debe ser `NEX-1001`;
- **conservar continuidad** si queda algún ticket o no se deben reutilizar códigos.

```sql
select max(substring(code from 5)::bigint) as max_ticket_number
from public.tickets
where code ~ '^NEX-[0-9]+$';

select last_value, is_called from public.ticket_code_seq;
```

Nunca ajustar la secuencia por debajo del mayor código conservado. Después del ajuste aprobado, crear un ticket controlado y comprobar código y unicidad.

## Fase 6: revisión de plataforma

### Auth

- Site URL igual al dominio canónico HTTPS;
- Redirect URLs explícitas, sin wildcards amplios;
- política mínima de contraseña aprobada;
- Leaked Password Protection habilitada y Security Advisor limpio;
- expiración JWT y rotación/reutilización de refresh tokens revisadas;
- signup público deshabilitado si el alta sigue siendo administrativa;
- plantillas, remitente y SMTP propio probados;
- recuperación de contraseña probada de extremo a extremo.

### Storage

- bucket `ticket-attachments` privado;
- límite de tamaño aprobado;
- lista explícita de MIME types;
- políticas RLS vigentes;
- URLs firmadas con expiración limitada;
- carga, descarga y bloqueo cruzado A/B probados.

### Base y seguridad

- cinco migraciones presentes en orden;
- RLS en todas las tablas expuestas;
- `anon` sin grants de tablas ni secuencia;
- políticas limitadas por tenant/rol;
- Security Advisor sin hallazgos bloqueantes;
- pruebas directas por UUID y Storage aprobadas.

## Fase 7: smoke test posterior

1. login, refresh y logout;
2. recuperación de contraseña;
3. creación de ticket y código esperado;
4. carga y lectura de adjunto permitido;
5. listado, filtros y detalle;
6. comentarios externo e interno;
7. asignación, prioridad, estado, resolución y reapertura;
8. historial;
9. bloqueo portal → backoffice;
10. bloqueo A → B por UUID y Storage;
11. logout sin acceso residual;
12. revisión de logs Auth, API, Storage y Vercel.

## Evidencia de cierre

El acta debe incluir autorización, operadores, backup y checksums, inventario antes/después, IDs conservados/eliminados, administrador validado sin credenciales, decisión de secuencia, configuración Auth/Storage, resultado RLS/smoke test, Security Advisor, commit/deployment e incidentes o rollback.
