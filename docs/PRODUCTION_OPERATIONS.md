# Operación productiva — Ticketera NexOps

## Modelo operativo actual

La Ticketera opera con un único proyecto Supabase productivo. Esta decisión es proporcional a una empresa de 4 personas y una cartera actual de 10 clientes. No se mantiene una base de staging paga ni PITR por ahora.

Controles compensatorios:

- backups diarios automáticos del plan Supabase Pro, con 7 días de retención;
- migraciones pequeñas, versionadas y aplicadas en orden compatible;
- CI obligatorio en cada cambio propuesto: lint, tipos, pruebas y build;
- smoke test del dominio productivo después de cada publicación;
- adjuntos privados, con MIME permitido y límite de 10 MB;
- descarga manual mensual de objetos de Storage y antes de cambios que afecten archivos.

## Secuencia de despliegue

1. Confirmar que el último backup diario terminó correctamente.
2. Ejecutar el preflight de datos para las constraints nuevas.
3. Aplicar primero migraciones aditivas (funciones, constraints y políticas compatibles).
4. Publicar la aplicación y verificar login, lectura y una mutación representativa.
5. Aplicar las revocaciones de permisos directos.
6. Ejecutar pruebas negativas y revisar Security Advisor.
7. Registrar fecha, commit, migraciones y resultado del smoke test.

Nunca se debe aplicar `20260828140000_revoke_direct_data_writes.sql` antes de que esté publicada la versión que usa las RPC de `20260828130000_data_integrity_boundary.sql`.

## Altas, bajas y accesos

- El alta se realiza por invitación; la persona define su contraseña.
- La contraseña debe tener al menos 12 caracteres.
- Para dar de baja a una persona, cambiar su estado a `disabled`. Las políticas de base rechazan inmediatamente sus lecturas y mutaciones aunque conserve una sesión anterior.
- Sólo un `platform_admin` puede crear o modificar roles internos.
- Un `team_lead` puede administrar perfiles cliente, pero no otorgar privilegios internos.
- La recuperación de acceso se inicia desde `/portal/recuperar-acceso` y no revela si el email existe.

## Backups y restauración

La copia diaria de Supabase cubre la base de datos, pero no los objetos de Storage. Mantener una exportación mensual de `ticket-attachments` en una ubicación privada controlada por NexOps. Antes de una migración destructiva o un cambio de bucket, realizar además una exportación puntual.

Si una publicación falla:

1. revertir el commit de aplicación o volver al deployment anterior;
2. no ejecutar la migración de revocaciones pendiente;
3. si la revocación ya fue aplicada, restaurar temporalmente sólo los grants anteriores mientras se corrige la aplicación;
4. usar la restauración de backup únicamente ante corrupción o pérdida de datos confirmada.

## Umbrales para revisar esta decisión

Reevaluar staging separado, PITR y controles adicionales cuando ocurra cualquiera de estos eventos:

- más de 25 clientes activos;
- ingreso de un cliente regulado o con requisitos contractuales específicos;
- más de 8 personas con acceso operativo;
- integraciones críticas o automatizaciones que escriban masivamente;
- incidentes repetidos que muestren que el esquema actual quedó corto.

Hasta entonces, se priorizan controles simples, verificables y de bajo costo.
