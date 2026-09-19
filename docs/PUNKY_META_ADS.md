# Meta Ads de Punky

## Configuración aplicada el 19 de septiembre de 2026

Repositorio: `AlanTN13/nexopsticketera`. Supabase: Ticketera nexops
(`tfonsiurhjmllqaknhgh`). Empresa: `punky`, ID
`a88d617e-f115-467a-a084-d0576480f45c`.

Alan confirmó que la cuenta publicitaria **Starcred pertenece exclusivamente a
Punky**. Se configuró el perfil `punky` de `PORTAL_METRICS_COMPANY_CONFIG` en el
entorno Production de **sdnexops**, proyecto Vercel que atiende
`https://portal.nexopstech.com`. El proyecto `nexopsticketera` atiende Soporte;
no confundir sus variables con las del portal.

El perfil de Punky contiene `accountName: "Starcred"` y `metaSheetUrl` apuntando
exactamente a la exportación Meta existente, previamente utilizada por Global
Trip. No se creó otro Sheet, no se copiaron snapshots entre empresas y no se
cambió ninguna fuente global. La URL se conserva en Vercel, no en este documento.

La referencia explícita a la fuente en el perfil fue necesaria: en el despliegue
real de sdnexops no había una fuente Meta global disponible. Agregar sólo el
nombre de cuenta dejaba el estado `unconfigured`. La exportación existente se
leyó y validó antes de vincularla: 1.504 filas, de las cuales 588 correspondían
exactamente a Starcred; fechas de Starcred desde 2026-07-01 hasta 2026-09-19.

La precedencia se mantiene: settings de la empresa, perfil del servidor y fuente
global como último recurso. Los settings de Punky conservan
`metaAdsEnabled: true`; Soporte sigue activo, Radar y Contenido deshabilitados.
El usuario conserva `metrics/view` y `support/admin`.

## Integración y evidencia de producción

El PR #80 fue revisado, pasó CI (lint, tipos, 250 pruebas, build y auditoría de
dependencias) y se integró en `main` como
`ddd18bfdadb2f898e265619791210c864cb82c56`.

El despliegue de sdnexops `BuBLFu5vLedFR39jhzRJJf2cggA8` quedó READY en Production,
asignado a `portal.nexopstech.com`, con ese commit y el perfil completo. Se ejecutó
«Actualizar datos» desde la sesión administrativa del portal. La base confirmó
un snapshot Meta propio de Punky en estado `ready`, con `fetched_at`
`2026-09-19T15:16:37.659Z`. Su fuente coincide con la exportación preexistente
(hash MD5 de la URL `51964939e41a5a3e860e257039015613`). El snapshot de Global Trip
conservó su fecha original: la operación no lo sobrescribió.

En `/portal/metricas?company=punky`, el portal mostró actualización correcta y
estas cifras para **21/08/2026–19/09/2026**, contrastadas con la exportación real:

| Indicador | Valor |
| --- | ---: |
| Filas Starcred del período | 210 |
| Inversión | $1.231.904,45 |
| Impresiones | 185.068 |
| Clics | 7.520 |
| CTR | 4,06 % |
| CPC | $163,82 |
| Conversaciones iniciadas | 2.786 |
| Costo por conversación calculado | $442,18 |

La moneda se presenta tal como la formatea el portal; no se verificó una moneda
ISO en la fuente. Estas cifras corresponden a la lectura del 19/09, no son
valores estáticos del producto.

## Corrección encontrada al verificar los indicadores

La tarjeta de costo usaba leads cuando existía al menos uno, aun con objetivo
CONVERSACIONES. En Punky había un lead y 2.786 conversaciones: la tarjeta mostraba
incorrectamente toda la inversión como costo por resultado, mientras las tablas
calculaban por conversación.

La corrección en `client-dashboard.tsx` reutiliza `metrics.costPerResult` y su
etiqueta por objetivo. Mantiene el identificador interno del KPI para conservar
preferencias. Las pruebas de render verifican conversaciones, leads y compras
cuando los tres tipos de resultados coexisten. No se cambió el objetivo de
Punky: se conserva el predeterminado CONVERSACIONES.

## Aislamiento y verificaciones

- El filtro de Meta se aplica en el servidor por igualdad de `Account name`,
  ignorando mayúsculas y espacios externos; nunca por campaña ni subcadena.
- La comprobación con la exportación real devolvió únicamente las 588 filas
  Starcred para Punky y únicamente las 219 filas GLOBAL TRIP para ese perfil.
- Una prueba con nombres parecidos, cuentas vacías y campañas que mencionan
  Starcred confirma que esos registros no se incorporan a Punky.
- El perfil configurado para Punky no altera el perfil de otras empresas.
  Meta continúa deshabilitado para Onlysellers y Dexa.
- Los clientes se resuelven por su `companyId`; manipular `?company=` no permite
  seleccionar otra empresa. Las pruebas cubren usuarios invitados,
  deshabilitados y sin permiso, además del nivel de lectura sin actualización.
- Los snapshots se consultan por `company_id`, con RLS y sin lectura directa
  para anon/authenticated. El navegador recibe las filas filtradas, no el CSV
  completo ni su URL.
- El PR #80 descarta snapshots de fuentes retiradas/reemplazadas y evita heredar
  datos anteriores si la nueva fuente falla. Sus mensajes públicos no exponen
  URLs ni nombres de otras cuentas.

## Pendiente del usuario

El usuario de Punky sigue con `users.status = invited`. La verificación visual
se hizo con la sesión administrativa en la vista de Punky, no con una sesión del
cliente. Debe aceptar la invitación y completar su acceso para verificar ese
último paso. No se modificaron credenciales ni se reenviaron invitaciones.
