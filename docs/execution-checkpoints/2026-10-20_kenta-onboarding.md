# Alta Kenta — checkpoint 2026-10-20

Estado: **BLOCKED_EXTERNAL_SESSION**. No se ejecutaron altas, modificaciones de permisos ni envíos.

## EXECUTION PREFLIGHT

- Rol y superficie real: Dirección de Ejecución del Portal; conectores GitHub/Supabase para lectura y evidencia, navegador in-app para flujo Backoffice. Cwd de sesión new-chat; no se afirma raíz trusted Alanos ni validación del piloto #32. Sin implementación local.
- Resultado y autorización: solicitud explícita de Alan para alta productiva de Kenta; Juan Alonso, Juan.alonso@bitek.com.ar, client_admin; únicamente Soporte y Métricas; invitación por circuito existente. Incluye persistencia en AlanOS.
- Contexto: Alanos Execution_Runtime_Contract.md blob c74478a3d868c5f9dd4bdc91a5414073dc469624; AGENTS ecee8e9; bootstrap 1d40462; Delivery Team Design be8d623; hogar Tiketera_NexOps.md 16b8873da67c58c8d90d47cc994e337746ec614d; Ultimo_Sync leído y delta Portal del 28/09 contrastado. Técnico main ee181b047cd82a7e2744a226c8b76bda3cef0bc0, AGENTS 6e12519.
- Budget S / tipo T4 / riesgo R3: configuración pequeña, con acceso a datos reales. Arquitectura A0: circuito existente.
- Alcance: verificar duplicados, alta por Backoffice, permisos por empresa/módulo, identificar fuente Ads, invitación y evidencia. Fuera: otras empresas, código, arquitectura, Auth/RLS/permisos globales, nuevas integraciones.
- Validación: verificar empresa/perfil/módulos/permisos persistidos; comprobar resultado de envío y distinguir aceptación proveedor de entrega; revisar aislamiento; sesión real de Juan pendiente hasta que él active y pruebe.
- Producción/recuperación: autorización específica del request; no se ha usado. Si hay error, detener y comprobar estado para no duplicar empresa/cuenta/envío. Baja por circuito existente si fuera necesaria, sin borrados improvisados.
- STOP: sesión interna ausente, acceso denegado, fuente Ads ambigua, ampliación de alcance o aislamiento incorrecto.

## Delivery design / capacidad

Dirección trabaja directamente: una sola configuración secuencial por UI; delegar no resuelve la sesión faltante. Reconocimiento focalizado y verificación posterior separada de cada mutación, con lecturas de base y revisión de contratos de autorización. No se cambian contratos de seguridad; sin afirmación de QA independiente ni smoke de cliente. Reservar QA para estado persistido, fuente real, resultado de invitación y límites de acceso. Sin builds, migraciones ni tests nuevos para configuración.

## Evidencia ejecutada

1. Supabase list_projects confirmó proyecto **Ticketera nexops**, ref **tfonsiurhjmllqaknhgh**, ACTIVE_HEALTHY.
2. SELECT focalizado devolvió un único objeto agregado: `companies: []` para name/slug ILIKE '%kenta%', `profiles: []` para email exacto sin distinción de mayúsculas o nombre Juan Alonso, `auth_matches: 0` para email exacto. No hay duplicados en ese corte; revalidar al retomar.
3. Navegador abrió https://portal.nexopstech.com/backoffice/companies y redirigió a **/portal/login**; campos vacíos. Alta no accesible sin sesión interna. Se pidió iniciar sesión normalmente; no se solicitaron/copiarion contraseñas, cookies ni tokens.
4. `src/lib/app-store.ts` blob f8694892a929d0293760a7128c1d94f287568d8c: createCompanyInSupabase crea empresa onboarding y administrador client_admin/invited; bootstrap de permisos support/admin y otros none. createSupabaseUserProfile genera enlace invite y llama sendAccountInvitationEmail.
5. `src/lib/email-service.ts` blob 705cbef1b96de84a39c05b28653d71f3fe9d85bc: circuito Resend, remitente soporte@nexopstech.com, asunto “Activá tu acceso a NexOps”. No se invocó ni comprobó envío.
6. Fuente Ads identificada por código: `src/lib/portal-modules.ts` dfe006396c35a0007f260db541872eae699c0f6b, `src/lib/metrics-sync.ts` ef95611ae2ac3bc3e3a417431f7fb437f199b3d8 y `src/lib/metrics-data.ts` 146436b0a79a38948b5b0bcc475e5eeff7ba349d. Meta Ads consume CSV publicado por docs.google.com; precedencia settings de empresa → perfil PORTAL_METRICS_COMPANY_CONFIG → fuente global PORTAL_METRICS_META_SHEET_URL. accountName filtra por igualdad, ignorando mayúsculas y espacios externos. Snapshots y sync por company_id; actualización manual/programada existente.
7. No hay perfil Kenta por defecto en portal-modules.ts. Esto **no prueba** ausencia de perfil en entorno productivo; no se leyeron valores de entorno. La empresa aún no existe, por lo tanto no tiene settings propios ni snapshots vinculados.
8. `src/lib/authorization.ts` f4f59ce2b43a1a57374b2ea240641a4530d8aefc exige usuario active, misma empresa y módulo enabled, más permiso personal. Métricas resuelve empresa cliente por companyId aunque cambie query company. Revisión estática; sin sesión de Juan ni prueba negativa viva.

## Estado por aceptación

| Criterio | Estado |
|---|---|
| Kenta creada | Pendiente; no existe en corte |
| Juan asociado client_admin | Pendiente; no existe cuenta/perfil |
| Ticketera y permisos | Pendiente |
| Métricas habilitado | Pendiente |
| Fuente Ads | Contrato identificado; fuente real Kenta y nombre de cuenta sin verificar |
| Invitación | No enviada |
| Aislamiento | Contrato revisado; validación de configuración y sesión pendientes |
| Acceso real Juan | No validado |

## Retomar

1. Alan inicia sesión interna en la pestaña Portal y avisa.
2. Revalidar duplicados; completar formulario real sin inventar industria (si es obligatoria, usar un marcador explícito “Pendiente de confirmar”, sin inferir giro).
3. Crear empresa/administrador por Backoffice; el alta envía invitación automáticamente. No repetir envío.
4. Habilitar únicamente support y metrics; radar/content OFF. Soporte admin y Métricas view como mínimo para visualizar resultados; verificar permisos efectivos según UI vigente.
5. Inspeccionar configuración productiva de fuente Ads y cuenta exacta. Si faltan, documentar necesidad de CSV/Sheet y mapeo confirmado; no conectar otra cuenta por parecido ni desarrollar integración.
6. Verificar resultado de envío/estado proveedor cuando accesible, sin abrir token de invitación del cliente. Validar configuración con lecturas y UI; Juan debe aceptar, definir contraseña e ingresar personalmente.
7. Actualizar este receipt y AlanOS con estados reales.

## EXECUTION RECEIPT / Knowledge Delta

Resultado parcial: diagnóstico y bloqueo documentados; ninguna mutación productiva. No código, PR, merge, deploy, pruebas ejecutadas ni integración nueva. No cambios a otras empresas. Frescura global AlanOS no graduada. Siguiente dependencia: sesión interna normal; datos Ads exactos sólo si no existen en configuración productiva.
