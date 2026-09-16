# Execution Receipt — invitaciones y filtros del perfil de cliente

Fecha: 2026-09-16. Repositorio: `AlanTN13/nexopsticketera`.

## Estado y lote

Un único [PR draft #77](https://github.com/AlanTN13/nexopsticketera/pull/77), rama `codex/company-filters-invitations`, base `9e2d6b279c2d346aa4ab86834cd499bd5c52d8d7`. Commit funcional: `e58f4889c7861b941463fa12aa8dd067d3c44040`.

- **B: implementado y validado en la ficha de empresa**, listo para revisar. No integrado ni promovido a producción por este lote.
- **A: diagnóstico confirmado; bloqueado por acceso externo a Resend.** No se configuró una key, no se verificó el dominio en Resend, no hubo redeploy productivo ni envío real de invitación. No declarar resuelto.
- No se modificaron Supabase/Auth, migraciones remotas, permisos, entitlements ni datos de clientes. La única acción productiva de tickets fue un lote al mismo estado existente, con respuesta de cero cambios.

## Reconciliación antes de editar

- `main` ya contiene #8 (Resend), #14 (modal de empresa y filtros múltiples de cola) y #76 (estados rápidos, selección compartida, On Hold y filtros básicos por empresa).
- No existe un PR abierto de filtros/multiselección para retomar. #77 **completa el remanente de #14/#76**: la ficha todavía usaba filtros de un solo valor y serializaba valores repetidos incorrectamente en el retorno del detalle. Conserva el contrato y la implementación de selección/estados de #76.
- PRs abiertos al iniciar: #49 (Contenido), #75 (Radar API), #22/#68/#69/#70/#71/#72 (dependencias). No se mezclan en este lote.
- Issues abiertos: #48, #50, #56. Los receipts antiguos y las issues no bastan para deducir el estado productivo; se contrastaron main, GitHub y el dashboard real. No se cerraron issues ajenos al alcance.

## A — hallazgo productivo

El navegador mostró el error real en Backoffice > Companies > Nueva empresa: `Falta configurar RESEND_API_KEY para enviar invitaciones.`

| Recurso | Evidencia observada |
|---|---|
| Portal | `portal.nexopstech.com` está asignado a **sdnexops**, equipo `alan-fernandezs-projects-f6e1f457` |
| Producción | [Deployment 4EyhoWVed1LDavGFtyd9cxW9Njff](https://vercel.com/alan-fernandezs-projects-f6e1f457/sdnexops/4EyhoWVed1LDavGFtyd9cxW9Njff), READY, main `9e2d6b2` |
| Variables sdnexops | Búsqueda `RESEND` sin resultados, tanto Project como Shared, All Environments |
| Proyecto anterior | **nexopsticketera**, dominio `soporte.nexopstech.com`, sí tiene `RESEND_API_KEY`, tipo **Secret**, Production, agregado Jul 18 |
| Recuperación de key | Vercel muestra `Copy to Clipboard` deshabilitado para ese Secret. No se leyó ni expuso su valor |
| Resend | Sin sesión; acceso por GitHub llega a autorización de lectura de emails de AlanTN13. La revisión automática rechazó ese grant; se solicitó autorización explícita o inicio de sesión por Alan. No se intentó eludirlo |

El conector Vercel omitía ambos proyectos y devolvía 404 por slug. La sesión del dashboard sí los muestra; ésta es la evidencia utilizada para identificar el destino.

### Flujo existente, sin cambios de Auth

`createCompanyAction` → creación de empresa → `createSupabaseUserProfile` → enlace temporal `/auth/callback?token_hash=…&type=invite` → `sendAccountInvitationEmail`. El servicio importa `server-only`, usa exclusivamente `RESEND_API_KEY` y el SDK Resend. Remitente: `NexOps Soporte <soporte@nexopstech.com>`; Reply-To: `info@nexopstech.com`. El flujo tiene compensación de usuario/empresa ante fallo. No se reimplementó ni alteró.

Las nuevas pruebas verifican: key ausente impide llamar al proveedor; remitente/destino/enlace correctos; HTML escapado; la key no forma parte del mensaje; error retornado por proveedor produce un mensaje genérico. Son pruebas con SDK simulado, **no entrega real ni validación de dominio**.

### Acción externa mínima y cierre pendiente

Alan debe autorizar explícitamente el inicio de sesión de Resend vía GitHub (lectura de emails) o iniciar sesión él mismo en la pestaña preparada. No enviar la key por chat.

Con ese acceso, completar en este orden:

1. Verificar `nexopstech.com` en Resend y que la credencial elegida permita enviar con `soporte@nexopstech.com`. Si hacen falta DNS o una nueva key, concretar únicamente esa acción externa.
2. Cargar la key como **Secret**, nombre exacto `RESEND_API_KEY`, en **sdnexops / Production**; nunca `NEXT_PUBLIC_*`, código, logs o mensajes. La key del proyecto anterior no está disponible para copiar desde Vercel.
3. Redeploy productivo de la versión acordada y comprobar READY en el dominio canónico.
4. Enviar una invitación a un destinatario controlado acordado con Alan; registrar resultado del formulario, ID/estado de entrega de Resend y recepción, sin almacenar el enlace/token. Hasta entonces A permanece bloqueado.

## B — comportamiento entregado

- La ficha `/backoffice/companies/[companyId]` usa `TicketFilters` en modo múltiple, como la cola general: estados, prioridades, áreas y responsables.
- Los valores repetidos llegan al mismo `filterTickets`: OR dentro de un campo y AND entre campos. El conjunto inicial siempre está limitado a la empresa.
- Canonicalización de ID a slug y retorno desde detalle conservan todos los valores, sin convertir arrays en una cadena separada por comas.
- El formulario compartido se reinicia al cambiar filtros/empresa; al quitar un chip no queda una casilla invisible marcada que reaparezca en el siguiente envío.
- Se reutilizan `TicketTable`, `TicketStatusProvider`, `updateTicketStatusesAction`, `canUpdateTicketWorkflow`, el catálogo `TICKET_STATUSES` y el RPC existente. Sin acciones ni enums paralelos.
- Selección visible/editable, guardado individual y masivo, On Hold, bloqueo durante envío, feedback y limpieza de selección permanecen compartidos.
- La vista operativa por cliente es la ficha de empresa del backoffice. Los usuarios cliente conservan lectura de estados en el portal; no reciben permisos de workflow nuevos.

## Evidencia ejecutada

- `npm test`: **49 archivos / 226 pruebas PASS**, incluyendo 9 nuevas pruebas del render real de ficha e invitación. Incluye suite PostgreSQL/PGlite con migraciones reales y pruebas negativas A/B, cliente, anónimo, permisos revocados, módulo apagado y rollback.
- `npm run lint`, `npm run typecheck`, `npm run build -- --webpack`: **PASS**.
- [CI del commit funcional](https://github.com/AlanTN13/nexopsticketera/actions/runs/35111814979/job/104847168289): **SUCCESS**. CI usa el build normal del repositorio.
- [Preview sdnexops](https://vercel.com/alan-fernandezs-projects-f6e1f457/sdnexops/FSAaHSLnqzoDvcfYgyFwggp7sChw): **SUCCESS/READY**. [URL verificada](https://sdnexops-kznz399p0-alan-fernandezs-projects-f6e1f457.vercel.app/portal/login): login renderizado. No se afirma smoke autenticado remoto de la nueva rama.
- [Preview nexopsticketera](https://vercel.com/alan-fernandezs-projects-f6e1f457/nexopsticketera/7XgW6zn5d4kA85fUtPoygHbCunw1): **SUCCESS** según check de Vercel.

### Navegador con cambios reales en base local

Aplicación Next compilada → Server Actions reales → cliente Supabase real → gateway Auth/PostgREST ficticio local → PostgreSQL/PGlite con migraciones reales → refresh de UI. Cuentas y datos ficticios. Sin credenciales de producción. Se reutilizó el gateway local de QA de #76, revisado antes de ejecutarlo.

1. Agente limitado a Company A ve solamente sus tickets.
2. Cambio individual a On Hold desde la ficha, confirmación `1 de 1` y persistencia después de recargar.
3. Lote de dos tickets a En análisis con doble clic: `2 de 2`, controles bloqueados durante envío y selección limpia. El historial final demuestra ausencia de duplicados.
4. Dos filtros de estado simultáneos: URL repetida, resultados correctos y selección anterior limpia.
5. Abrir detalle y volver conserva ambos filtros.
6. Quitar On Hold desmarca su checkbox; volver a filtrar no lo reinserta.
7. Buscar un ticket y cambiarlo fuera del filtro deja cero resultados y mantiene confirmación de éxito.
8. Rechazo RPC simulado muestra `No autorizado para actualizar la selección.` y conserva el estado persistido, sin falso éxito.
9. Móvil 390×844: selección y cambio a On Hold funcionan sin abrir detalle; filtro por responsable muestra sólo el ticket sin asignar; ancho de documento = viewport = 390.
10. URL directa a Company B con agente de A devuelve `Empresa no encontrada`.
11. Rol cliente ve On Hold y puede filtrarlo, sin selección ni controles para modificar estados. Consola capturada: sin errores/warnings.

[Estado final local](evidence/company-filters-invitations/postgres-state.json): Company B intacta en `new`; prioridad y responsable conservados; exactamente **5** entradas de cambio de estado (1 individual + 2 del lote + 1 cierre + 1 móvil).

[Ficha escritorio / error](evidence/company-filters-invitations/company-error-desktop.png) · [Ficha móvil](evidence/company-filters-invitations/company-mobile.png) · [Login preview](evidence/company-filters-invitations/preview-login.png).

### Smoke productivo acotado

En la ficha real de Sysnexops se seleccionaron NEX-1015 y NEX-1016, ambos ya Resuelto, y se aplicó **Resuelto**. Respuesta observada: `0 de 2 ticket(s) actualizado(s) a Resuelto. Los demás ya tenían ese estado.` Los controles se deshabilitaron durante el envío y la selección se limpió al terminar. Esto confirma que el RPC y el recorrido masivo de #76 están disponibles en producción, pero **no prueba un cambio productivo a On Hold**.

## Riesgos, límites y rollback

No hay migraciones nuevas ni cambios de permisos. El código del lote se revierte con el commit funcional; no requiere borrar datos. Las pruebas locales no certifican Auth/Storage hospedados ni entrega de correo. La nueva ficha fue probada funcionalmente en local; su preview remota fue probada hasta login. Mantener A bloqueado y el PR revisable hasta resolver credencial/dominio y envío real.

## Knowledge Delta

1. El nombre del repositorio no identifica el proyecto productivo del Portal: **sdnexops** sirve `portal.nexopstech.com`; **nexopsticketera** sirve `soporte.nexopstech.com`.
2. La key de Resend quedó en el proyecto anterior. Su existencia allí no configura sdnexops ni certifica dominio/entrega.
3. #76 ya estaba en main y desplegado, aunque su receipt decía pendiente de release. El smoke sin cambios confirma la acción masiva productiva.
4. El pendiente de multiselección de **valores de filtro** seguía en la ficha. #77 lo completa reutilizando controles y workflow existentes.
5. Ningún usuario cliente recibió permisos de cambio de estado; la operación sigue sujeta a las mismas autorizaciones internas y RLS.
