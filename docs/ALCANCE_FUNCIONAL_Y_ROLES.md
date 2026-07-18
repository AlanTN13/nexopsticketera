# Alcance funcional y roles

## 1. Propósito de la plataforma

El **Centro de Soporte NexOps** centraliza las solicitudes que una empresa cliente necesita comunicar, seguir y resolver con NexOps. Su objetivo es evitar pedidos dispersos, conservar una conversación ordenada y dejar visible el estado, el responsable y el próximo paso de cada caso.

La plataforma tiene dos espacios:

- **Portal Cliente:** permite a los usuarios de una empresa consultar sus tickets, crear solicitudes cuando su rol lo autoriza, aportar contexto y conversar con NexOps.
- **Backoffice NexOps:** permite al equipo interno trabajar sobre los tickets de todas las empresas, responder, registrar notas internas y administrar el flujo operativo.

El modelo es **multiempresa**. Cada usuario cliente pertenece a una empresa y solo accede a la información de esa cuenta. El equipo NexOps opera una vista transversal para atender múltiples empresas.

Acceso oficial: <https://soporte.nexopstech.com>

## 2. Alcance funcional actual

### 2.1 Autenticación

- Inicio de sesión con email y contraseña.
- Redirección automática al Portal Cliente o al Backoffice NexOps según el perfil.
- Cierre de sesión desde ambos espacios.
- Validación de sesión en cada operación sensible.
- Alta administrativa de usuarios con una contraseña inicial de al menos ocho caracteres.

La recuperación automática de contraseña no está disponible en la interfaz actual.

### 2.2 Visualización, búsqueda y filtros

El Portal Cliente muestra únicamente los tickets de la empresa del usuario. El Backoffice muestra la cola conjunta de todas las empresas.

En ambos espacios se puede:

- buscar por código o título;
- filtrar por estado, área y prioridad o nivel de atención;
- limpiar filtros individualmente o en conjunto;
- ordenar los resultados por última actualización, de más reciente a más antigua;
- abrir el detalle desde la fila o tarjeta del ticket.

El Backoffice también permite filtrar por empresa y responsable, incluido “Sin asignar”.

### 2.3 Creación de tickets

Los roles cliente autorizados pueden crear tickets de tipo **Problema** o **Mejora**. El formulario solicita:

- título y descripción;
- área;
- impacto informado;
- urgencia informada;
- posibilidad de continuar trabajando;
- hasta tres enlaces de contexto;
- hasta tres imágenes opcionales.

El ticket nace con estado **Nuevo**, prioridad **Media** y sin responsable asignado. El cliente no define la prioridad operativa.

Impacto, urgencia y continuidad se conservan actualmente como texto dentro de la descripción. No existen todavía como campos independientes para búsqueda, filtros o reportes.

### 2.4 Detalle, conversación e historial

El detalle presenta código, título, estado, prioridad o nivel de atención, responsable, última actualización, próximo paso, descripción, conversación e historial. El Portal Cliente también muestra los enlaces y adjuntos iniciales. El detalle actual del Backoffice no los expone, aunque formen parte del ticket.

- Los **mensajes externos** son visibles para el cliente y NexOps.
- Las **notas internas** son visibles únicamente para los roles internos.
- Los mensajes se muestran en orden cronológico.
- El historial registra creación, comentarios, cambios de estado, cambios de prioridad y asignaciones.
- Los adjuntos se descargan mediante accesos temporales y privados.

El próximo paso mostrado no es un campo editable: se calcula a partir del estado actual y, en algunos casos, de si existe un responsable.

### 2.5 Gestión operativa

Los roles internos autorizados pueden modificar en un único formulario:

- estado;
- prioridad;
- responsable asignado.

Los cambios reales generan entradas de historial. Guardar el mismo estado no genera un evento de cambio de estado, aunque el guardado puede actualizar la fecha general del ticket.

### 2.6 Gestión de empresas y usuarios

- Todos los usuarios cliente pueden consultar el directorio de su propia empresa.
- `client_admin` puede crear usuarios cliente de su empresa desde el Portal Cliente.
- El Portal Cliente no ofrece actualmente edición ni eliminación de usuarios.
- `team_lead` y `platform_admin` pueden crear y actualizar usuarios internos o cliente.
- `team_lead` y `platform_admin` pueden crear y actualizar empresas.
- No existe una acción de eliminación de usuarios en la interfaz actual.

La interfaz denomina “Invitar usuario” al alta, pero el comportamiento real es una creación directa con email confirmado y contraseña inicial. No se envía un enlace de invitación como parte de este flujo.

### 2.7 Métricas e indicadores

El Portal Cliente muestra:

- tickets abiertos;
- tickets en progreso;
- tickets de nivel crítico;
- tickets resueltos o cerrados.

El Backoffice muestra:

- tickets activos;
- tickets de prioridad alta o crítica;
- tickets esperando al cliente;
- cantidad de empresas.

La sección de empresas agrega indicadores de usuarios, tickets abiertos y tickets críticos por cuenta. Son indicadores operativos básicos; no hay SLA, tiempos de resolución, tendencias ni reportes exportables.

### 2.8 Notificaciones por email

Hay cuatro eventos implementados:

1. un cliente crea un ticket: se avisa a NexOps;
2. un cliente publica un mensaje externo: se avisa a NexOps;
3. NexOps publica una respuesta externa: se avisa al creador del ticket;
4. NexOps cambia realmente el estado: se avisa al creador del ticket.

El envío es complementario. La acción principal queda guardada aunque el proveedor de correo no pueda entregar la notificación.

### 2.9 Desktop y mobile

La interfaz es web y responsive:

- en desktop utiliza navegación lateral, tablas y paneles de gestión;
- en mobile transforma los listados en tarjetas y utiliza una página completa para crear tickets;
- los formularios y detalles reorganizan sus columnas según el ancho disponible.

No existe una aplicación móvil nativa ni funcionamiento sin conexión.

## 3. Ciclo de vida del ticket

| Estado | Significado funcional | Acción esperada |
| --- | --- | --- |
| **Nuevo** | La solicitud ingresó y todavía no fue evaluada. | NexOps revisa y clasifica el caso. |
| **En análisis** | NexOps está comprendiendo el alcance y definiendo el abordaje. | NexOps analiza, solicita información o comienza el trabajo. |
| **En progreso** | Existe trabajo activo sobre el ticket. | NexOps continúa con la resolución. |
| **Esperando al cliente** | Hace falta información, validación o una decisión de la empresa cliente. | El cliente responde mediante un mensaje externo. |
| **Resuelto** | NexOps considera completada la solución. | El cliente confirma o informa que el problema continúa. |
| **Cerrado** | No quedan acciones pendientes para el caso. | Sin acción, salvo que NexOps decida reabrirlo. |

Los roles `agent`, `team_lead` y `platform_admin` pueden seleccionar cualquiera de los estados disponibles. La aplicación no impone una secuencia cerrada de transiciones ni realiza cierres automáticos.

El cliente no puede cambiar el estado directamente. Para confirmar una resolución o pedir reapertura debe publicar un mensaje; NexOps realiza el cambio correspondiente. Cada cambio real de estado queda en el historial y genera una notificación al creador del ticket cuando su email es válido.

## 4. Roles y permisos efectivos

### 4.1 Matriz de permisos

Leyenda: **Sí** = disponible; **No** = no autorizado; **Propia empresa** = limitado a la empresa del usuario.

| Permiso | `client_viewer` | `client_operator` | `client_admin` | `agent` | `team_lead` | `platform_admin` |
| --- | --- | --- | --- | --- | --- | --- |
| Ver tickets | Propia empresa | Propia empresa | Propia empresa | Todas | Todas | Todas |
| Crear tickets | No | Propia empresa | Propia empresa | No | No | No |
| Publicar mensajes externos | No | Propia empresa | Propia empresa | Sí | Sí | Sí |
| Ver directorio de usuarios | Propia empresa | Propia empresa | Propia empresa | Todas | Todas | Todas |
| Crear usuarios desde la interfaz | No | No | Propia empresa | No | Sí | Sí |
| Editar usuarios desde la interfaz | No | No | No | No | Sí | Sí |
| Ver notas internas | No | No | No | Sí | Sí | Sí |
| Publicar notas internas | No | No | No | Sí | Sí | Sí |
| Modificar estado | No | No | No | Sí | Sí | Sí |
| Modificar prioridad | No | No | No | Sí | Sí | Sí |
| Asignar responsable | No | No | No | Sí | Sí | Sí |
| Operar múltiples empresas | No | No | No | Sí | Sí | Sí |
| Crear o editar empresas | No | No | No | No | Sí | Sí |
| Administrar catálogos o configuración global disponible | No | No | No | No | Sí | Sí |

### 4.2 Observaciones sobre la matriz

- `client_viewer` puede consultar tickets, mensajes externos, historial, adjuntos y usuarios de su empresa, pero no crear ni comentar.
- `client_operator` y `client_admin` tienen las mismas capacidades sobre tickets.
- La diferencia actual de `client_admin` es la creación de usuarios de su empresa. La edición no está expuesta en el Portal Cliente.
- Los tres roles internos tienen iguales permisos operativos sobre tickets.
- `team_lead` y `platform_admin` comparten actualmente las capacidades globales implementadas para empresas y usuarios. No existe todavía una diferencia funcional adicional visible entre ambos.
- “Configuración global” se limita hoy a las pantallas implementadas de empresas y usuarios; no hay un módulo general de parámetros, SLA, áreas o plantillas.

## 5. Notificaciones

### 5.1 Eventos cubiertos

| Evento | Destinatario | Contenido principal |
| --- | --- | --- |
| Ticket nuevo creado por cliente | NexOps | Empresa, usuario, código, título, prioridad inicial, área y descripción. |
| Mensaje externo nuevo del cliente | NexOps | Usuario, empresa, código, título y mensaje. |
| Respuesta pública de NexOps | Creador del ticket | Código, título, autor y respuesta. |
| Cambio real de estado | Creador del ticket | Código, título, estado anterior y estado nuevo. |

Los emails incluyen un enlace al ticket, versión visual y versión de texto.

### 5.2 Reglas y exclusiones

- Las notas internas no generan emails y su contenido no se incorpora a avisos para clientes.
- Guardar nuevamente el mismo estado no genera otro aviso de estado.
- Dos cambios de estado distintos conservan identidades de evento diferentes, incluso si repiten la misma transición.
- Los cambios de prioridad o asignación quedan en el historial, pero no generan email en esta etapa.
- Una respuesta interna del mismo usuario que creó el ticket no se envía como notificación a sí mismo.
- El destinatario de respuestas y estados es el creador original del ticket, no todos los usuarios de la empresa.

## 6. Seguridad funcional

- Cada cuenta cliente está asociada a una empresa y solo puede consultar tickets, conversaciones, historial, adjuntos y usuarios de esa empresa.
- El código o enlace directo de un ticket no reemplaza la autorización: un cliente no obtiene acceso a un ticket ajeno por conocer su dirección.
- Las notas internas se filtran antes de llegar al Portal Cliente.
- Los adjuntos se almacenan de forma privada y se entregan mediante enlaces temporales al usuario autorizado.
- El modelo de acceso utiliza cuentas individuales; compartir contraseñas contradice la política de uso.
- La sesión autenticada y el rol efectivo se vuelven a comprobar al ejecutar acciones.
- Los clientes no pueden entrar al Backoffice ni modificar el flujo operativo.

## 7. Fuera de alcance y limitaciones actuales

### No disponible actualmente

- recuperación automática o autoservicio de contraseña;
- flujo operativo de invitación por enlace, con vencimiento y aceptación;
- edición o eliminación de usuarios desde el Portal Cliente;
- eliminación de usuarios desde la interfaz;
- área “No estoy seguro” o “Por clasificar” persistente;
- campos dedicados y filtrables para impacto, urgencia y continuidad;
- campo editable de próximo paso, responsable del próximo paso o fecha estimada;
- adjuntos en mensajes posteriores: las imágenes se cargan durante la creación del ticket;
- adjuntos generales distintos de imágenes en el formulario actual;
- visualización de enlaces y adjuntos iniciales dentro del detalle del Backoffice;
- notificaciones por cambios de prioridad o asignación;
- notificación a todos los usuarios de una empresa;
- SLA, vencimientos, escalamiento automático o cierre automático;
- reglas obligatorias de transición entre estados;
- reportes avanzados, exportaciones o tableros históricos;
- aplicación móvil nativa y modo offline;
- catálogo administrable de áreas, estados o prioridades desde la interfaz.

### Capacidades parciales

- Impacto, urgencia y continuidad se solicitan, pero se guardan como parte de la descripción.
- El próximo paso se muestra, pero se deriva automáticamente del estado.
- Existe una ruta preparada para aceptar enlaces de invitación, pero el alta utilizada por la interfaz crea la cuenta directamente y no envía ese enlace.
- `team_lead` y `platform_admin` existen como roles separados, pero hoy comparten las capacidades globales implementadas.

## 8. Criterio de vigencia

Este documento describe el comportamiento confirmado en `main` al momento de su creación. Toda capacidad futura debe incorporarse al producto antes de presentarse como disponible y debe actualizarse en este documento y en el manual de uso.
