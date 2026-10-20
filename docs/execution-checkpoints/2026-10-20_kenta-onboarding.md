# Alta Kenta — checkpoint 2026-10-20

Estado vigente: **METRICS_LIVE_VERIFIED_ADMIN_SESSION**. Kenta muestra métricas de pauta reales en producción; ver resultado productivo al final. Invitación enviada por circuito automático; entrega/login cliente independientes pendientes.

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


## Cierre de evaluación — 2026-10-20 20:44 UTC

Estado vigente: **PARTIAL / BLOCKED_VERCEL_PROJECT_ACCESS**. Alan autorizó continuar (“bueno hacelo nomas”) para mostrar únicamente el dashboard existente. Fuente compartida y cuenta exacta Kenta Ads confirmadas; asociación productiva todavía NO aplicada, dashboard sin datos.

- La propuesta de UI/código PR #93 fue preparada y luego rechazada por revisión independiente: UPDATE autenticado no permitido y URL de CSV compartido no debe guardarse en company_modules, legible por clientes. PR cerrada sin merge; no desplegar esa rama. Ninguna migración, RLS, Auth ni permiso fue alterado.
- Vía existente revisada con dictamen independiente GO: PORTAL_METRICS_COMPANY_CONFIG, sólo servidor, añadir perfil kenta con accountName Kenta Ads y metaSheetUrl compartida, preservando las demás entradas. company_modules debe conservarse intacto. Snapshot/sync tienen RLS y carecen de SELECT/policies para anon/authenticated; el servidor filtra por empresa y cuenta exacta y no entrega URL/CSV crudo al cliente.
- El conector Vercel enumera el equipo team_Dd84rleycBIFoY84LaXy5BYj / alan-fernandezs-projects-f6e1f457 pero no encuentra sdnexops; get_project y env devolvieron 404 y listado no contiene ese proyecto. No se leyó ni modificó ninguna variable.
- Chrome de Alan no tenía sesión Vercel. GitHub devolvió account_not_linked; método habitual Google inició sesión alantn13 con equipo alan-fernandezs-projects vacío. El proyecto exacto sdnexops figura Not Found. No cambiar identidades ni permisos para eludirlo. Hace falta que Alan entre con la cuenta administradora correcta del proyecto.
- Próxima ejecución autorizada cuando exista acceso: verificar proyecto/dominio y baseline productivo exacto; leer únicamente el perfil servidor, añadir Kenta conservando otros perfiles; redeploy de ese baseline; actualizar fuentes por UI existente y validar métricas/campañas Kenta, frescura y ausencia de URL compartida en respuestas cliente. Sin código nuevo ni cambios globales.
- Invitación permanece como antes: disparada automáticamente al crear, sin reenvío y sin verificación independiente de entrega o login de Juan.


## Resultado productivo — 2026-10-20 20:52 UTC

Estado vigente: **METRICS_LIVE_VERIFIED_ADMIN_SESSION**. El bloqueo de acceso quedó resuelto al usar la pestaña Vercel que Alan abrió en su Chrome perfil Joaquin, sesión sysnexops-7509. No se cambiaron identidades ni privilegios para eludir controles; se usó la sesión administrativa presentada por Alan.

- Vercel proyecto sdnexops, dominio portal.nexopstech.com, repositorio AlanTN13/nexopsticketera verificados por UI. Baseline production READY dpl_97seZHqpmGomLng6KqJVDCfau4o6, SHA 95c01e5547c5656536e445cf6cd08bc416156c7e.
- Variable existente PORTAL_METRICS_COMPANY_CONFIG tenía sólo punky/Starcred. Se conservó íntegro ese objeto y se añadió exclusivamente kenta: accountName Kenta Ads y metaSheetUrl CSV compartido ya confirmado. Target Production conservado, tipo Config conservado. UI confirmó Updated Environment Variable successfully. company_modules, permisos, Auth y RLS no modificados.
- Redeploy del código del baseline seleccionado, sin Build Cache: [dpl_97Zy1kHLbUo32mHqi9j28AxCcdfQ](https://vercel.com/alan-fernandezs-projects-f6e1f457/sdnexops/97Zy1kHLbUo32mHqi9j28AxCcdfQ), SHA 95c01e5, Production, READY en 51s. Overview recargado confirmó ese deployment como Production Deployment y dominio portal.nexopstech.com.
- Portal recargado mostró cuenta Kenta Ads y habilitó la primera actualización. Se ejecutó una actualización manual normal. Retorno company=6086ee9e-fa7c-4036-95c9-b92b60df8870&updated=1; mensaje Los datos se actualizaron correctamente. Última actualización 20/10/2026 17:50 ART; último dato 2026-10-20.
- Últimos 30 días: inversión $367.887,42; impresiones 1.184.749; clics 5.497; conversaciones 41; CPC $66,93; CPM $310,52; CTR 0,46%; costo/conversación $8.972,86. Valores reportados por el dashboard, no verificación contable ni evaluación comercial.
- Tabla de campañas: KENTA | TOFU | Reconocimiento | Sept26 ($292.334,56; 3 conversaciones) y Sorteos ($75.552,86; 38 conversaciones). Ranking muestra seis creativos propios de Kenta.
- Lectura DOM actual: identificador de URL CSV compartida ausente del HTML del documento; texto de Starcred/Global Trip/OnlySellers/Punky ausente del body. Es comprobación focalizada de esta respuesta administrativa, complementa contrato/revisión DB; no es sesión negativa viva de Juan.
- Captura completa inspeccionada: KPIs y tablas legibles y cargados. Ejes/tooltip del gráfico presentes; no se certifica el trazado de curvas de esa captura. No se amplió alcance con cambios del componente.
- Invitación ya disparada por el alta automática, sin reenvío. Entrega independiente y activación/login personal de Juan siguen sin comprobarse. Kommo permanece sin reporte, fuera del alcance de pauta.
- PR #93 continúa cerrada/sin merge; no código nuevo, migración, fuente global ni otras empresas modificadas. Recuperación de configuración: restaurar el JSON anterior sólo con punky/Starcred y redeploy compatible; no ejecutada.

Este cierre documental se guarda en rama docs/kenta-dashboard-verification-20261020 para no generar otro rollout productivo sólo por el receipt. Hogar/Ultimo_Sync canónicos se reconcilian con enlace inmutable al receipt; frescura global ajena preservada.


## Acceso con contraseña — preflight autorizado 2026-10-20

En curso; todavía sin mutación al registrar este preflight. Alan ordenó conservar para después el fallo del enlace y asignar contraseña compleja al usuario existente; renovó instrucción “metete por supabase y asignala despues la cambia”.

EXECUTION PREFLIGHT / DELIVERY DESIGN / PATCH MODE: Dirección de Ejecución; operación S/T4/R3. Baseline Juan/Kenta exacto user4c745c8c-df8c-4e9e-b47c-e13b80d130c0/company6086ee9e-fa7c-4036-95c9-b92b60df8870/emailjuan.alonso@bitek.com.ar/client_admin/statusinvited; email confirmado23:08:44Z y sin password. Contexto RuntimeContractc74478a3/DecisionFrameworkca30a979; código auth67a883d exige statusactive. Revisor independiente GO para API Admin oficial; confirma identidademail exacta, sin bloqueo/borrado/sesiones/tokens pendientes. Escritura SQL directa de credencial descartada por invariantes administradas por Auth. Credencial admin ya presente en .env.local del checkout conocido, proyecto URL exacto verificado sin exponer valor ni modificar repo.

Delta autorizado: API auth.admin.updateUserById(id,{password}) con nueva contraseña CSPRNG (<72bytes, clases requeridas) y activación sólo del perfil público exacto; conservar empresa/rol/metadatos/módulos/permisos. Congelados: enlaces/callback/recovery, dashboard, configuración global/Auth/RLS, otras cuentas, código y despliegues. Verificación: lecturas API antes/después y autenticación aislada sin persistencia de sesión, comprobación de accesos; contraseña sólo para Alan, nunca Git/receipt. No es clave con vencimiento ni cambio forzado. Recuperación: ante fallo previo no mutar; ante resultado parcial registrar etapa y preferir completar activación exacta; no restaurar credencial desconocida ni recrear usuario. STOP ante identidad/proyecto distintos, credencial inválida/denegación, actividad concurrente o efectos fuera del alcance. Sin spoof de claims, nuevas claves ni infraestructura.
