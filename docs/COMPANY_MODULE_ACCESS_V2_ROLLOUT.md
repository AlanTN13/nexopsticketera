# Módulos y permisos V2 — Runbook de rollout

El gate productivo fue otorgado el 2026-09-01 con la indicación de usar la base existente y evitar una branch con costo. La ejecución y su evidencia están registradas en el Execution Receipt.

## Contrato de acceso

El acceso efectivo se concede únicamente cuando se cumplen las cuatro condiciones: usuario activo, empresa propia/asignada, módulo habilitado y nivel suficiente. `platform_admin` reemplaza la asignación y el permiso explícito, pero no el entitlement: un módulo deshabilitado también se le deniega.

`view` permite lectura; `operate`, las acciones normales del módulo; `admin`, la configuración funcional. Ninguno de esos niveles concede el control comercial de módulos, empresas atendidas o permisos: ese control queda reservado a `platform_admin`.

## Ensayo seguro

1. Crear o seleccionar una base efímera sin datos productivos; si Dirección autoriza expresamente la base productiva como único entorno, capturar primero el snapshot lógico y usar fixtures sin colisiones dentro de una transacción con `ROLLBACK`.
2. Aplicar todas las migraciones desde cero.
3. Ejecutar `supabase/tests/module_access_v2_rls.sql` con `ON_ERROR_STOP=1`.
4. Ejecutar lint, typecheck, tests y build de la aplicación.
5. Validar en preview con identidades A/B: cliente A, cliente B, interno asignado sólo a A y administrador de plataforma.
6. Verificar por ruta, ID, Data API y acción que B nunca pueda observar u operar A; que `view` no opere; que un cliente no pueda cambiar workflow; y que el nivel funcional `admin` no modifique el control plane.

Para Storage, cargar `supabase/tests/module_access_v2_storage_fixture.sql` únicamente en la base local y ejecutar `supabase/tests/module_access_v2_storage.mjs` con la URL, anon key y JWT secret locales. La operación `remove` puede devolver una respuesta vacía cuando RLS filtra el objeto; la aserción correcta es que el objeto siga descargable por su owner y sólo desaparezca después del borrado autorizado.

## Orden de rollout

1. Migración expand-only: catálogo, filas para empresas existentes, tablas de asignación/permisos/auditoría, helpers, RLS, Storage, triggers y RPCs.
2. Comprobar backfill: Soporte preservado; Métricas/Radar conservan sus flags/settings; internos sólo reciben Soporte; no se inventa acceso a Contenido.
3. Desplegar la aplicación sobre la misma base de preview.
4. Ejecutar la matriz A/B y revisar `access_audit_log`.
5. Mantener el PR en draft mientras algún control figure `NOT_RUN` o `BLOCKED_EXTERNAL`.
6. Solicitar un gate separado antes de cualquier migración o promoción productiva. Gate de base recibido y ejecutado el 2026-09-01.

## Recuperación fail-closed

- Si falla la UI, revertir el artefacto de aplicación y conservar tablas, permisos, auditoría y RLS V2.
- Si falla una RPC, corregirla con una migración forward-only; no restaurar helpers globales por rol.
- Para suspender un módulo, deshabilitar su entitlement: los grants se conservan, pero su acceso efectivo pasa a `none`.
- No eliminar tablas ni backfill durante el incidente. Exportar primero asignaciones, permisos y auditoría si una corrección posterior necesitara transformar datos.
- La promoción productiva y cualquier rollback de datos requieren aprobación explícita y un receipt nuevo.

## Evidencia requerida para el gate productivo

- migración aplicada en preview aislada;
- test SQL RLS completo verde;
- aislamiento A/B autenticado por URL, acción, ID, Data API y Storage;
- suite, lint, typecheck y build verdes;
- revisión independiente auth/RLS sin P0/P1 abiertos;
- preview READY y Execution Receipt actualizado.
