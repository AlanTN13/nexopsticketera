# Alta Kenta — checkpoint 2026-10-20

Estado vigente: **PARTIAL / BLOCKED_METRICS_CONFIGURATION_WRITE**. La fuente compartida y la cuenta Kenta Ads ya fueron identificadas; falta guardar la asociación por una vía administrativa autorizada. El estado anterior de ausencia de fuente efectiva se conserva abajo como evidencia del primer intento.

Estado al primer corte: **PARTIAL / BLOCKED_METRICS_SOURCE**. Empresa y administrador creados; Soporte y Métricas habilitados con permisos guardados. La pauta todavía no muestra datos porque no tiene fuentes configuradas. Invitación disparada por el circuito automático de alta; entrega al buzón y acceso real de Juan no comprobados.

## EXECUTION PREFLIGHT / diseño proporcional

- Rol y superficie real: Dirección de Ejecución Portal; UI en Chrome del usuario y conectores GitHub/Supabase para lectura/evidencia. Sin implementación local; no se certifica raíz trusted Alanos ni piloto #32.
- Autorización directa renovada: Alan respondió “isisis mandae” al pedido exacto de crear Kenta, Juan Alonso (Juan.alonso@bitek.com.ar) como administrador cliente, únicamente Soporte/Métricas y enviar la invitación. Después agregó “que dispare el mail, todo ehh”.
- Contexto vigente: Execution_Runtime_Contract.md blob c74478a3d868c5f9dd4bdc91a5414073dc469624; AGENTS ecee8e9; hogar y checkpoint previos contrastados. Los controles de la plataforma prevalecen.
- S / T4 / R3: configuración pequeña sobre accesos reales. A0: reutilizar alta, productos y permisos existentes. Una ejecución secuencial de Dirección, sin subagentes; no se afirma revisión independiente.
- Dentro: sólo Kenta/Juan, Soporte, Métricas, validación focalizada y evidencia. Fuera: código, nuevas integraciones, arquitectura, Auth/RLS/permisos globales, otras empresas.
- Validación: estado persistido de empresa/usuario/módulos/permisos, lectura administrativa del dashboard y una actualización real de fuentes. Sesión cliente no simulada.
- Recuperación: no recrear ni duplicar cuenta/invitación tras demoras de UI; comprobar estado antes de reintentar. Si se solicita retirar acceso, usar el circuito existente. Sin borrado, reset ni cambios de contraseña.
- STOP: fuente inexistente/ambigua, denegación de acceso, necesidad de nueva integración o ampliación de alcance. No sustituir datos ni elegir una cuenta por parecido.

## Delta ejecutado y evidencia

1. Revalidación previa al alta: cero coincidencias de Kenta en companies por nombre/slug; cero users por email exacto o Juan Alonso; cero Auth por email exacto. Una primera consulta equivocó public.profiles: error de lectura, corregido tras inspeccionar esquema; sin efectos.
2. Alta única por Backoffice, confirmación “Empresa creada correctamente.”:
   - Empresa `6086ee9e-fa7c-4036-95c9-b92b60df8870`, nombre Kenta, slug kenta, status onboarding.
   - Industria “Pendiente de confirmar”, sin inferir giro; plan growth asignado por formulario existente, sin cambio de pricing/compromiso.
   - Juan `4c745c8c-df8c-4e9e-b47c-e13b80d130c0`, email normalizado juan.alonso@bitek.com.ar, company_id Kenta, role client_admin, status invited.
   - created_at empresa 2026-10-20T20:06:12.251801Z; invited_at Auth 2026-10-20T20:06:12.642037Z (17:06 ART).
3. Productos guardados desde UI; verificación SELECT:
   - support=true, metrics=true, radar=false, content=false.
   - metrics.settings={metaAdsEnabled:true}; no accountName ni metaSheetUrl propios.
4. Permisos personales guardados desde UI; verificación SELECT para Juan:
   - únicamente Kenta/support/admin y Kenta/metrics/view.
   - sin permisos de otras empresas y sin user_company_assignments.
   - Perfil pertenece exclusivamente a Kenta; sin roles internos. Radar/Contenido no disponibles. Es verificación de configuración; no prueba negativa viva con sesión cliente.
5. Dashboard administrativo abierto en https://portal.nexopstech.com/portal/metricas?company=kenta. Muestra cuenta Kenta, indicadores “Esperando datos de la cuenta”, campañas/creatividades “Disponible al conectar la fuente”. No se mostraron datos ajenos ni resultados inventados.
6. Una actualización manual ejecutada desde el control existente. SELECT de metrics_sync_state confirmó:
   - status error; last_trigger manual; last_attempt_at 2026-10-20T20:08:37.086516Z.
   - last_error: “Esta empresa todavía no tiene fuentes de métricas configuradas.”
   - last_success_at null; sin snapshots vinculados a Kenta.
   - Esto confirma ausencia de fuentes efectivas para Kenta en esa ejecución; no se leyó ni alteró configuración global ni se implementó integración.
7. Contrato técnico: src/lib/portal-modules.ts dfe0063 y src/lib/metrics-sync.ts ef95611. Meta Ads usa CSV de Google Sheets publicado, filtrado por cuenta exacta. Precedencia: settings empresa → perfil servidor → fuente global. Hace falta fuente real Kenta y mapeo confirmado de cuenta para continuar configuración y validar números/frescura. No introducir otra tecnología por este bloqueo.

## Invitación y cambio de secuencia solicitado

- El alta automática envía la invitación dentro de createSupabaseUserProfile; no existe paso separado de “crear sin enviar” en el flujo usado.
- Alan pidió después “antes de mandarle la invitacion valida que se vea la info de metrica porfa de pauta”. El alta ya estaba ejecutada y Auth tenía invited_at; se informó inmediatamente que el circuito había disparado la invitación y se pasó a validar pauta. No se reenvió el correo.
- Evidencia de aplicación: éxito UI de alta y perfil/Auth persistidos. Código leído src/lib/app-store.ts f869489 y src/lib/email-service.ts 705cbef1: espera sendAccountInvitationEmail y falla/retira la cuenta si Resend devuelve error; éxito es evidencia indirecta de aceptación del envío por la aplicación, no un evento independiente de entrega del proveedor.
- Destinatario único juan.alonso@bitek.com.ar; remitente NexOps Soporte <soporte@nexopstech.com>; asunto “Activá tu acceso a NexOps”.
- Entrega al buzón no comprobada. Intento de abrir dashboard Resend rechazado por revisión automática: acceso a otra fuente privada requiere autorización explícita. No se eludió el rechazo; no se obtuvo ID/evento delivered.
- Email confirmado y last_sign_in_at estaban null en la lectura posterior al alta. No se consumió enlace/token ni se configuró contraseña por Juan.

## Estado por aceptación

| Criterio | Estado |
|---|---|
| Kenta creada sin duplicados | Verificado en UI y base |
| Juan client_admin de Kenta | Verificado en base y UI |
| Soporte habilitado / permiso administrar | Guardado y verificado; login cliente pendiente |
| Métricas habilitado / permiso ver | Guardado y verificado |
| Datos reales de pauta | BLOQUEADO: sin fuente efectiva; actualización real falló con causa explícita |
| Radar y Contenido | OFF; sin permiso personal |
| Invitación | Circuito automático disparado y alta completada; entrega independiente no verificada |
| Aislamiento | Configuración y contrato revisados; sesión negativa viva pendiente |
| Acceso personal Juan | Pendiente de activación/prueba por Juan |

## EXECUTION RECEIPT / Knowledge Delta

Trabajo directo de Dirección, una sola alta y una actualización de fuentes; sin agentes, builds, pruebas de código, despliegues ni migraciones. No se modificaron otras empresas, Auth/RLS global, secretos ni arquitectura. Timeout de observación resuelto leyendo estado, sin repetir mutaciones.

Resultado parcial: onboarding configurado; no declarar Métricas operativo con datos de pauta. Próximo dato necesario: Google Sheet/CSV existente de Kenta y nombre exacto de cuenta; autorización adicional sólo si se requiere construir integración nueva. Entrega Resend requiere permiso de lectura al proveedor si se quiere comprobación independiente. Acceso Juan pendiente. Reconciliar este delta en el hogar NexOps y Ultimo_Sync sin graduar frescura global.

[Historia previa del checkpoint](https://github.com/AlanTN13/nexopsticketera/blob/9f3754d9176a6adc0e33f877478a57a742833e94/docs/execution-checkpoints/2026-10-20_kenta-onboarding.md).


## Corrección de fuente compartida — 2026-10-20

- Alan aclaró “es el mismo de los otros amigoo”. Autoriza reutilizar la fuente existente para Kenta; no solicita ni autoriza una nueva integración o desarrollo.
- Lectura focalizada de configuración/snapshots de Métricas confirmó que Global Trip y Punky consumen la misma fuente Meta Ads:
  `https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMAsRhvllZApkl8ODRQjCfOFKJBNQqzPi-pZm13VcJ3jVcj9Lu533NoW-iXzTItqjhA7hsu2MrW7E/pub?gid=822437464&single=true&output=csv`.
- El snapshot compartido READY, fetched_at 2026-10-20T03:23:04.182Z, contiene registros de la cuenta exacta **Kenta Ads** y campañas KENTA | TOFU | Reconocimiento | Sept26. Se encontraron 137 líneas físicas que contienen Kenta; no se afirma que sean 137 registros CSV, porque hay campos multilínea.
- La fuente de clientes del mismo documento (gid 111380031) también identifica client_name y account_name **Kenta Ads**. No se copiaron branding, estrategia, objetivos ni valores de otro cliente.
- Configuración mínima identificada: conservar metrics.enabled=true y metaAdsEnabled=true; asociar únicamente accountName=Kenta Ads y metaSheetUrl al CSV compartido. No cambiar fuente global ni otras empresas. Fuente real no necesita nueva planilla de Alan.
- Intento de guardar sólo esa configuración en la fila Kenta/metrics por el conector SQL fue rechazado con SQLSTATE 42501: “No autorizado para administrar la configuración del módulo.” La transacción no tuvo efectos. SELECT posterior confirmó settings={metaAdsEnabled:true}, sin asociación guardada.
- Diagnóstico de la vía legítima: trigger private.enforce_access_control_write exige actor autorizado; no se alteró ni se suplantaron claims. El formulario Backoffice observado sólo tiene disponibilidad de productos, Meta Ads ON/OFF y Kommo/Radar. La función vigente set_company_modules acepta metaAdsEnabled y kommoEmbedUrl, pero no accountName/metaSheetUrl. No hay guardado de esas fuentes en ese circuito.
- No se insistió con otra escritura privilegiada, JWT simulado, desactivación de trigger/RLS, credenciales ni ruta indirecta. Sin nuevo refresh equivalente: la configuración sigue igual y el resultado conocido seguiría sin fuente.
- **Nuevo bloqueo preciso: guardado autorizado de la asociación**, no inexistencia de datos. Para ampliar el Backoffice con esa configuración se necesita autorizar un desarrollo acotado; el mandato inicial excluye desarrollos no solicitados. No se implementó código por este hallazgo.
- Reconciliar el hogar y el índice: fuente y cuenta confirmadas; fuente efectiva aún sin vincular; pauta no operativa. Mail y acceso Juan conservan los límites del primer corte.


## Comprobación con navegador administrativo de Alan — 2026-10-20

- Nueva instrucción de Alan: “usa mi navegador dale”. Se identificó su Chrome perfil alan con Supabase autenticado, organización nexops y proyecto Ticketera nexops tfonsiurhjmllqaknhgh/main Production.
- Se abrió Table Editor → public.company_modules mediante controles normales. La fila exacta company_id 6086ee9e-fa7c-4036-95c9-b92b60df8870 / module metrics tenía {metaAdsEnabled:true}.
- Se preparó en el editor JSON únicamente metaAdsEnabled conservado + accountName Kenta Ads + metaSheetUrl compartida confirmada; un único intento de guardar por Enter.
- La UI mostró temporalmente el JSON propuesto y luego volvió a {metaAdsEnabled:true}. SELECT independiente confirmó que no se persistió la asociación. No se capturó una nueva explicación de error del editor; no atribuir una excepción específica no observada en esta vía.
- Esta fue una comprobación por la superficie administrativa normal expresamente solicitada, con sus controles activos. No se cambiaron rol de conexión, claims, RLS, triggers, claves ni privilegios; no se insistió ni se abrió otra vía privilegiada tras comprobar que tampoco persistía.
- Estado conservado PARTIAL / BLOCKED_METRICS_CONFIGURATION_WRITE. Fuente y cuenta identificadas; falta guardado autorizado. Siguiente propuesta, todavía sin aprobar: ajuste puntual en Backoffice para guardar fuente/cuenta usando la sesión real del administrador. El mandato inicial prohíbe desarrollos no solicitados; no se implementó ese ajuste.
