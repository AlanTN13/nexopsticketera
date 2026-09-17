# Execution Receipt — Onlysellers / Emailing

Fecha: 2026-09-17. Repositorio: AlanTN13/nexopsticketera.

## Estado

Configuración productiva y sincronización completadas. Dashboard real verificado desde la sesión administrativa. Permisos efectivos del cliente verificados con RLS. **El smoke de navegador autenticado como cliente permanece pendiente de disponer de su sesión**; no se presenta el smoke administrativo ni la prueba SQL como un login de cliente.

## Reconciliación

- Main inicial: `f6277a4f27917349dd2c9a41be45c666c3c24d2b` (#77).
- Producción inicial: sdnexops, deployment `AG6jFVvn4kjT64ooQH5aZjJ8gEyU`, Ready, mismo SHA, dominio `portal.nexopstech.com`. Verificado en dashboard Vercel; el conector devolvió 404 para ese proyecto.
- Base canónica: Ticketera nexops, proyecto `tfonsiurhjmllqaknhgh`.
- Onlysellers no existía en la primera consulta. Durante la ejecución apareció el alta a las `2026-09-17T14:16:24Z`, antes de la transacción de configuración. Se reutilizó mediante búsqueda por nombre normalizado/slug; **esta ejecución no insertó otra empresa ni otro usuario**.

## Empresa, usuario y configuración real

- Empresa: **OnlySellers**, slug `onlysellers`, ID `438bf465-265d-4f93-8d8b-fa6b960585d4`, onboarding.
- Usuario existente: **Juan Ignacio Sarasola**, `onlysellersfba@gmail.com`, ID `adb2ee46-1d0e-4778-bc50-81f3c4d0e1c4`, `client_admin`. Primero observado Invitado y posteriormente Activo. No se cambiaron contraseña ni estado de activación, ni se reenvió la invitación.
- Métricas ON; Soporte, Radar y Contenido OFF.
- Settings: `accountName: Onlysellers`, `mailchimpName: Onlysellers`, `metaAdsEnabled: false`; sin `kommoEmbedUrl`.
- Única fila de permiso: `metrics / view`. Se retiró el permiso inicial `support / admin` generado por el alta normal.
- Configuración mediante conector SQL en transacción, atribución administrativa NexOps Tech `1a27cd84-4c4c-4fd9-b3af-55a68c514e15`, motivo explícito de solicitud Alan y ejecución por conector. Se conservaron triggers de autorización y auditoría; permisos aplicados por `set_user_module_permissions`, módulos por `set_company_modules`.

## Fuente real

- No se encontró `PORTAL_METRICS_*` en variables Project ni Shared de sdnexops en Vercel.
- Global Trip ya utilizaba un CSV compartido mediante su setting `mailchimpSheetUrl`. Su snapshot contenía campañas de Onlysellers.
- Se descargó nuevamente ese CSV: HTTP 200, `text/csv`, 19.274 bytes UTF-8. El parser vigente `parseMailchimpCSV` produjo 53 filas; el filtro real por cuenta o audiencia produjo **9 campañas de Onlysellers**.
- Se reutilizó únicamente esa URL como `company.modules.metrics.settings.mailchimpSheetUrl` de Onlysellers. No se copiaron fuentes de Meta, clientes ni estrategia; no se agregó UI ni variable global.
- La comparación de cuenta/audiencia es igualdad sin distinguir mayúsculas, después de trim. `OnlySellers` coincide con `Onlysellers`.
- Huella SHA-256 de la URL, sin publicar la URL: `3ebd929eeb0db5ae458db2599dc9d09bf9c24d7354f2809ce1ad256d8df108bd`.
- Huella SHA-256 del CSV validado: `4f6207eaa6f1316a84a75f40c977c682ef05a4578dd6e4bc8e16674cddba4231`.
- Fechas reales: 2026-06-24, 07-01, 07-08, 08-05, 08-11, 08-13, 08-20, 08-25 y 08-27. No hay campañas de septiembre en esta fuente; no se inventaron ni completaron datos.

## Sync productivo y dashboard

Desde `/portal/metricas?company=onlysellers`, sesión administrativa real, se ejecutó la Server Action existente de actualización.

- `last_trigger: manual`, `status: ready`, `last_error: null`.
- Intento: `2026-09-17T14:18:47.583260Z`; éxito: `2026-09-17T14:18:47.994Z`.
- Un único snapshot: `mailchimp`, ready, 18.994 caracteres, sin error. No se creó snapshot Meta para Onlysellers.
- UI: “Los datos se actualizaron correctamente”; único selector de canal: **Emailing**. No hay selector Meta Ads ni Kommo.
- El control administrativo de actualización conserva copy genérico que menciona Meta; el usuario `metrics:view` no ve ese control. Existe el aviso heredado de Kommo no configurado, sin habilitar su canal.

| Rango probado en producción | Campañas | Enviados | Entregados |
| --- | ---: | ---: | ---: |
| Últimos 30 días | 3 | 37.806 | 37.476 |
| Histórico | 9 | 116.278 | 114.048 |
| Mes anterior (agosto) | 6 | 76.547 | 75.387 |
| Este mes (septiembre) | 0 | Estado vacío correcto | Estado vacío correcto |

Histórico: 17.749 aperturas únicas, tasa 15,56%; 216 clics únicos, CTR 0,19%; 535 bajas; 2.230 rebotes. La tabla, KPIs y gráfico cambiaron coherentemente al cambiar período. Las campañas mostradas pertenecen a Onlysellers.

## Autorización

Prueba SQL productiva transaccional con `SET LOCAL ROLE authenticated` y contexto del usuario cliente, terminada en ROLLBACK:

- `metrics:view = true`.
- `metrics:operate`, Soporte, Radar y Contenido = false.
- Métricas de Global Trip = false.
- Única empresa visible por RLS: OnlySellers.

Esta prueba verifica las políticas reales con su identidad; **no constituye una sesión Auth ni un smoke de navegador del cliente**. Se solicitó disponer de la sesión cliente para completar ese punto; la sesión disponible continúa siendo administrativa.

## Corrección mínima y validación

El cron reconstruía los settings de Métricas sin copiar `metaAdsEnabled`, recuperando el valor por defecto true. Se conserva ahora el booleano almacenado. No se altera el dashboard, el parser, las fuentes ni el diseño.

Regresión ejecutada a través de `refreshAllMetricsCompanies`: con Meta OFF solicita y persiste sólo Mailing incluso si hay fuente Meta global; con Meta ON o valor ausente conserva el comportamiento anterior. Son datos ficticios exclusivamente de prueba, nunca cargados en producción.

- 50 archivos / **229 pruebas PASS**.
- Typecheck, lint y build de producción webpack: PASS.
- [PR #78](https://github.com/AlanTN13/nexopsticketera/pull/78) integrado el `2026-09-17T14:26:02Z`; main `52ec5ad39d49da4a9d6817a994a5d50a0c51d27b`.
- [CI](https://github.com/AlanTN13/nexopsticketera/actions/runs/35233327634/job/105242795161): SUCCESS; previews de ambos proyectos: SUCCESS.
- [Producción sdnexops](https://vercel.com/alan-fernandezs-projects-f6e1f457/sdnexops/2NkPSJfirVx2DvKGRFczSkdiFEwZ): SUCCESS según estado de GitHub/Vercel del commit integrado.
- Producción del proyecto anterior nexopsticketera: SUCCESS, deployment `8rq8Yj2oPbUfWeZz7D44XZBSppma`, mismo commit. La integración habitual de main despliega ambos proyectos.
- Ficha real de empresa reabierta: exactamente un usuario activo; Métricas habilitada / Ver; demás módulos no disponibles / Sin acceso; checkbox Meta apagado y Kommo vacío. Auditoría visible en la ficha.

## Knowledge Delta y pendiente real

1. La fuente compartida de Mailing no era una variable global: estaba configurada por empresa en Global Trip y ya tenía las nueve campañas de Onlysellers.
2. No hizo falta una pantalla de configuración: se reutilizó el setting backend existente y sólo ese CSV.
3. El alta inicial concede Soporte administrar; configurar sólo la empresa no basta. Se dejó el usuario con `metrics:view` y ningún otro permiso.
4. La actualización diaria perdía el flag Meta OFF al hidratar settings; la corrección evita volver a consultar Meta por herencia global.
5. El usuario se activó durante la ejecución; no necesita un segundo alta/invitación. Queda por verificar su ingreso real de navegador y el recorrido Inicio → Métricas → Emailing con su sesión.
6. No existen envíos posteriores al 27 de agosto en el CSV consultado. Un septiembre vacío es el resultado correcto, no un error de sincronización.

Rollback de código: revertir la corrección de hidratación; no requiere migraciones. La configuración productiva queda auditada y es independiente del deploy. No borrar la empresa ni el usuario para revertir código.
