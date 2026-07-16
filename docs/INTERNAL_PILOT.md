# Piloto interno controlado

## Entorno

- Supabase único: `tfonsiurhjmllqaknhgh`.
- Duración prevista: 7 a 14 días.
- Participantes: únicamente personal autorizado de NexOps.
- No se cargan datos reales de clientes externos.
- Todo dato temporal queda inventariado para la limpieza preproducción.

## Marcadores obligatorios

- Empresas temporales: slug `pilot-internal-*`.
- Usuarios: email controlado de NexOps o `@example.invalid`, con decisión de conservación registrada.
- Tickets: título con prefijo `[PILOT]`.
- Comentarios: sin secretos, credenciales o datos personales reales.
- Adjuntos: sintéticos y sin información comercial.

Los marcadores ayudan a clasificar, pero no habilitan borrado automático.

## Entrada al piloto

- deployment y rama identificados;
- responsable operativo y suplente;
- cuentas participantes inventariadas;
- RLS A/B y Storage aprobados;
- backup lógico vigente;
- Leaked Password Protection resuelta o riesgo aceptado por escrito;
- recuperación manual acordada hasta implementar autoservicio;
- límites de adjuntos acordados;
- canal de incidentes definido.

## Matriz funcional

### Portal

- login, refresh y logout;
- creación con prioridad, área, descripción y URLs de contexto;
- adjuntos sintéticos;
- listado, filtros, detalle, comentarios e historial;
- resolución/cierre visible;
- recuperación de contraseña cuando esté implementada.

### Backoffice

- recepción, clasificación y asignación;
- prioridad y estado;
- comentario interno y respuesta externa;
- resolución y reapertura controlada;
- métricas básicas;
- gestión autorizada de empresa y usuarios.

### Seguridad

- cliente sin acceso a backoffice;
- UUID ajeno bloqueado;
- comentarios internos ocultos;
- adjuntos privados y paths ajenos bloqueados;
- cliente sin cambio de workflow;
- sesión cerrada sin acceso residual.

## Operación diaria

Registrar participantes, tickets creados/resueltos, fallos Auth, errores API/Storage, tiempos percibidos, problemas UX/mobile/accesibilidad, incidentes, decisiones y todo dato temporal nuevo. Los logs no deben contener credenciales o contenido sensible.

## Criterios de pausa

Pausar ante fuga entre empresas, comentario interno visible, adjunto sin autorización, exposición de `service_role`, pérdida/corrupción de datos, imposibilidad de revocar sesión o errores repetidos que impidan operar tickets.

## Salida

El piloto termina con resultados aprobados/fallidos, backlog por severidad, inventario final, decisión de conservación, autorización separada para `PREPRODUCTION_CLEANUP.md` y smoke test final previo al uso oficial.
