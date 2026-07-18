# Estado V1 técnico

## Estado de integración y despliegue

La PR #5 de UX P0 fue integrada en `main` mediante squash and merge. El commit canónico es `ecf2baaa3cebc4869beac0efcaba7800d3eb7bea`. Los deployments productivos de Vercel asociados finalizaron correctamente y el dominio `https://sdnexops.vercel.app` respondió sin errores visibles en los smoke tests públicos de login, rutas protegidas, portal, backoffice y URLs de tickets por `ticketCode`.

La UX P0 está completada: la interfaz es más compacta y operativa, conserva la identidad NexOps, mejora sidebar, listados, creación, detalle, responsive y estados de interfaz, y utiliza URLs públicas legibles sin reemplazar el UUID interno. La V1 queda lista para iniciar el piloto interno controlado según `docs/INTERNAL_PILOT.md`; esto no equivale todavía a una salida oficial a clientes.

## Entorno Supabase definitivo

El proyecto `tfonsiurhjmllqaknhgh` se utiliza para desarrollo y piloto interno y será la base productiva definitiva. No se debe crear otro proyecto. Durante el piloto solo se permiten datos controlados e identificables; su limpieza futura exige backup completo y autorización separada según `docs/PREPRODUCTION_CLEANUP.md`.

La configuración de Auth quedó alineada con el dominio productivo:

- `Site URL`: `https://soporte.nexopstech.com`
- Redirect permitido: `https://soporte.nexopstech.com/**`
- Redirect local conservado: `http://localhost:3000/**`

## Implementado en main

- Supabase es el único backend.
- Sesiones oficiales SSR reemplazan la cookie HMAC propia.
- Lecturas y mutaciones normales usan la identidad del usuario y respetan RLS.
- `service_role` queda restringido a dos operaciones `auth.admin`: crear y actualizar cuentas.
- Se retiraron store JSON, seed automático, contraseña demo, reset y fallback.
- La migración V1 normaliza grants, RLS, funciones privadas, Storage, constraints e índices.
- Los códigos de ticket se generan mediante secuencia Postgres, evitando carreras de aplicación.
- Existe una suite mínima de seguridad y métricas.

## Validación de staging

Las cinco migraciones fueron aplicadas en `tfonsiurhjmllqaknhgh`. Pasaron las pruebas reales A/B con JWT, acceso directo por ID, comentarios internos, Storage, Auth SSR y el recorrido funcional de portal/backoffice. Security Advisor conserva únicamente el warning de Leaked Password Protection deshabilitada, que debe resolverse antes del uso oficial.

## Invitaciones

El alta sigue siendo directa por un administrador con contraseña inicial. Aceptación por email, expiración y recuperación de contraseña quedan pendientes.

## Notificaciones por email del MVP

La infraestructura de Resend quedó preparada sobre `nexopstech.com`:

- dominio verificado en Resend;
- remitente: `NexOps Soporte <soporte@nexopstech.com>`;
- `Reply-To`: `info@nexopstech.com`;
- `RESEND_API_KEY` cargada en Vercel para Production;
- `NEXT_PUBLIC_APP_URL=https://soporte.nexopstech.com` cargada en Vercel para Production.

La integración server-only con el SDK oficial de Resend quedó implementada. Centraliza transporte, plantilla responsive, alternativa de texto plano, escape de contenido de usuarios, validación de destinatarios y URL pública. Los fallos de Resend no revierten la mutación principal ni exponen el error técnico al usuario; las claves idempotentes mitigan duplicados durante reintentos.

Alcance funcional aprobado para el MVP:

- Cuando el cliente crea un ticket, NexOps recibe un único aviso.
- Cuando el cliente publica un mensaje externo en un ticket existente, NexOps recibe un aviso.
- Cuando NexOps publica un mensaje externo, el creador del ticket recibe un aviso.
- Cuando NexOps cambia el estado del ticket, el creador del ticket recibe un aviso.
- Las notas internas no generan email.
- Los cambios de prioridad o asignación no generan email en esta etapa.
- La creación del ticket no debe producir dos correos por representar también el primer mensaje del cliente.

La suite automatizada cubre los cuatro disparadores, notas internas, estados sin cambio, tolerancia a fallos y ausencia del doble aviso inicial. No se modificaron esquema, migraciones, grants, Auth ni RLS.

Los cuatro eventos fueron validados manualmente en producción: ticket nuevo, mensaje del cliente, respuesta pública de NexOps y cambio real de estado. Durante la validación, las notas internas no generaron notificaciones, no se observaron duplicados y los enlaces incluidos utilizaron `https://soporte.nexopstech.com`. No se registran en este documento IDs ni evidencias de entrega no disponibles.

## Dominio propio

`soporte.nexopstech.com` quedó validado y asociado al deployment productivo de Vercel. El CNAME publicado por Donweb apunta al destino específico solicitado por Vercel y fue comprobado contra Google DNS y ambos nameservers autoritativos de Donweb.

## Pendientes antes del piloto con GlobalTrip

- Implementar y validar la recuperación de contraseña de extremo a extremo.
- Habilitar Leaked Password Protection antes del uso productivo oficial.
- Completar el flujo real de área **Por clasificar** cuando el cliente elige “No estoy seguro”, sin crear un área ficticia permanente.
- Persistir en Supabase los campos de impacto, urgencia informada, continuidad de trabajo y próximo paso; la UX actual no sustituye estos cambios de datos pendientes.
- Revisar por separado las dos vulnerabilidades moderadas de dependencias, sin ejecutar correcciones automáticas destructivas.

Estos pendientes no forman parte de la integración UX P0 y requieren alcance, validación y autorización propios. No se aplicaron migraciones, cambios de RLS ni limpieza de datos durante esta actualización documental.

## Vulnerabilidades npm

- `js-yaml` quedó actualizado mediante override compatible a `5.2.1`.
- Next se actualizó de `16.2.6` a `16.2.10`.
- `npm audit` conserva dos entradas moderadas que representan una sola cadena: PostCSS `<8.5.10` embebido por Next y Next como dependencia afectada. El proyecto no acepta CSS de usuarios ni ejecuta un stringify de CSS no confiable; el uso observado es build-time, por lo que no se identificó una ruta explotable en la aplicación.
- npm propone bajar a Next `9.3.3`; se rechazó por destructivo. También se probó un override de PostCSS y se descartó porque dejó el árbol npm inválido. Debe actualizarse cuando Next publique una dependencia corregida compatible.
