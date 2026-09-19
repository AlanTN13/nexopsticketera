# Meta Ads de Punky

## Estado verificado el 19 de septiembre de 2026

Repositorio: `AlanTN13/nexopsticketera`. Base: Ticketera nexops
(`tfonsiurhjmllqaknhgh`). Empresa: `punky`, ID
`a88d617e-f115-467a-a084-d0576480f45c`.

La empresa y su usuario ya existían. Se habilitó Métricas desde el Backoffice
con la sesión administrativa existente, usando los formularios y RPC protegidos
del producto. Se verificó por lectura de la base:

- `company_modules`: `metrics.enabled = true`, `settings.metaAdsEnabled = true`.
- Usuario de Punky: permiso `metrics / view`; conserva `support / admin`.
- Soporte sigue habilitado; Radar y Contenido siguen deshabilitados.
- La invitación del usuario sigue pendiente (`users.status = invited`). Debe
  aceptar su invitación para acceder; no se modificaron credenciales ni se enviaron mensajes.
- Los cambios quedaron registrados en la auditoría de accesos del portal.

Se abrió `/portal/metricas?company=punky` con la sesión administrativa y se
verificaron el nombre Punky, el único canal Meta Ads y los indicadores `—`
pendientes. Esto verifica la vista administrativa de esa empresa, no una sesión
del cliente: todavía no puede validarse su inicio de sesión mientras siga invitado.

La configuración anterior ya está aplicada. Los cambios de código descritos abajo
requieren integrar y desplegar esta rama para aparecer en producción.

## Fuente pendiente y decisión de aislamiento

El portal integra exportaciones CSV de Google Sheets, no la API directa de Meta.
La precedencia de la fuente es:

1. `company_modules.settings.metaSheetUrl` del módulo `metrics`.
2. `PORTAL_METRICS_COMPANY_CONFIG` para el slug de la empresa, campo `metaSheetUrl`.
3. `PORTAL_METRICS_META_SHEET_URL`, fuente compartida del servidor.

La cuenta se resuelve desde `settings.accountName`, luego el perfil configurado
y finalmente el nombre de la empresa. Para Punky queda `Punky`. No hay una URL
propia ni una cuenta publicitaria alternativa confirmadas para esta empresa.

Se revisó la fuente publicada utilizada por los snapshots Meta existentes con
un parser CSV: **0 filas con `Account name = Punky`**. Había 85 filas que mencionan
Punky, pero su `Account name` era **Starcred**. Una mención en campañas o anuncios
no demuestra que toda la cuenta Starcred pertenezca exclusivamente a Punky.
Por eso no se vinculó Starcred ni se copiaron snapshots de otro cliente.
No se guardan exportaciones reales ni URLs privadas en el repositorio.

Pendientes concretos:

1. Confirmar el nombre exacto de la cuenta publicitaria y si Starcred pertenece
   exclusivamente a Punky. Si reúne empresas, preparar una exportación exclusiva
   de Punky con una identidad inequívoca; no alcanza un filtro parcial de campaña.
2. Configurar la fuente propia y la cuenta confirmada en los settings de Métricas,
   o usar el perfil de servidor existente. Ejemplo conceptual (reemplazar ambos
   valores; no pegar marcadores como configuración real):

   ```json
   {
     "punky": {
       "accountName": "NOMBRE EXACTO CONFIRMADO",
       "metaSheetUrl": "URL HTTPS DE GOOGLE SHEETS PUBLICADA COMO CSV"
     }
   }
   ```

   Incorporar la entrada al JSON existente de `PORTAL_METRICS_COMPANY_CONFIG`,
   conservando las de otras empresas. Los settings guardados en la empresa
   tienen prioridad. No cambiar la fuente global para conectar una sola empresa.
3. Confirmar el objetivo comercial (`CONVERSACIONES`, `LEADS` o `COMPRAS`);
   mientras no exista otro valor, el dashboard usa el estándar `CONVERSACIONES`.
4. Ejecutar «Actualizar datos» desde una sesión interna autorizada, o esperar el
   cron de las 00:05 de Argentina. El cliente tiene lectura, sin actualización manual.
5. Completar la invitación del usuario y verificar su sesión real.

La exportación debe identificar cada fila con `Account name` y fecha (`Day`).
El parser existente admite inversión, impresiones, alcance, clics, conversaciones,
leads, compras y el desglose de campañas/creatividades; los KPIs y filtros de fecha
se reutilizan sin inventar resultados si faltan datos.

## Comportamiento y permisos

- Crear una empresa/usuario no habilita automáticamente Métricas: requiere el
  producto habilitado y un permiso personal `view` o superior.
- La navegación se deriva de esos permisos. El cliente sólo puede consultar su
  `companyId`; cambiar `?company=` no permite seleccionar otra empresa.
- Las páginas y la acción de actualización autentican al actor y verifican su
  acceso antes de utilizar el cliente administrativo de Supabase.
- Los snapshots se consultan por `company_id`, permanecen en tablas con RLS y sin
  permisos de lectura directa para `anon`/`authenticated`. El servidor entrega
  únicamente filas cuya cuenta coincide exactamente, ignorando mayúsculas y
  espacios externos. No hay coincidencia por nombre de campaña ni por subcadena.
- Las fuentes y los CSV completos no se pasan al dashboard del navegador.
- El bloque muestra estados diferentes para fuente sin configurar, primera
  actualización pendiente, fuente sin registros de la cuenta, error y datos
  anteriores disponibles. Los avisos no revelan URLs ni nombres de otras cuentas.
- Al quitar o reemplazar la fuente Meta se dejan de mostrar sus snapshots previos.
  Una actualización fallida conserva datos anteriores sólo si la URL de la fuente
  no cambió (aplica también a las demás fuentes del sincronizador).

## Archivos y verificación

- `src/lib/metrics-data.ts`: estado de Meta y descarte de snapshots de una fuente retirada/reemplazada.
- `src/lib/metrics-sync.ts`: resolución común de URL Meta y protección de la caché al reemplazar fuentes.
- `src/lib/metrics-source-status.ts`: mensajes públicos de estado.
- `src/app/portal/metricas/page.tsx`: presentación de esos mensajes con `InlineNotice`.
- `tests/punky-meta-metrics.test.ts`: permisos, navegación, parámetros manipulados,
  filtros exactos, cuentas ajenas, fuentes y estados pendientes.
- `tests/metrics-refresh-source-change.test.ts`: fallo de actualización con fuente
  igual/reemplazada y consultas limitadas al ID de empresa.
- `tests/metrics-channel-availability.test.ts`: expectativa de la nueva presentación.
- Este documento: configuración aplicada, evidencia y pasos para conectar datos.

Validación: revisión de tipos, suite de 250 pruebas y ESLint aprobados. La suite
incluye pruebas PostgreSQL con las migraciones reales del proyecto. No se
modificaron tablas, políticas RLS, roles ni la arquitectura de autenticación.

La compilación de producción con `npm run build -- --webpack` también pasó.
`npm run build` (Turbopack) quedó bloqueado por una restricción del entorno local
al abrir el puerto usado para procesar CSS (`Operation not permitted`), incluso
al reintentar con permisos ampliados. No se cambió el compilador predeterminado
del repositorio; CI debe validar la compilación habitual.
