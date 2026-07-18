# Manual de uso

## Centro de Soporte NexOps

Acceso oficial: <https://soporte.nexopstech.com>

Este manual explica cómo utilizar la plataforma según el tipo de usuario. Las acciones visibles dependen del rol asignado a cada cuenta.

## Parte A — Usuario cliente

### 1. Acceso a la plataforma

1. Abrí <https://soporte.nexopstech.com>.
2. Ingresá tu email y contraseña.
3. Seleccioná **Ingresar**.
4. Si la cuenta es cliente, la plataforma abrirá el Portal Cliente.

La cuenta debe haber sido creada previamente por un administrador autorizado. No compartas la contraseña con otras personas.

### 2. Inicio y cierre de sesión

La sesión permanece asociada a tu navegador mientras siga vigente. Para terminarla, seleccioná **Cerrar sesión** desde la navegación o el encabezado del detalle.

Si la sesión venció, la plataforma vuelve al login y solicita las credenciales nuevamente.

### 3. Pantalla principal

La pantalla **Tickets** combina indicadores y listado.

Los indicadores muestran:

- **Abiertos:** tickets en Nuevo, En análisis, En progreso o Esperando al cliente.
- **En progreso:** tickets con trabajo activo.
- **Nivel crítico:** tickets clasificados por NexOps con el nivel más alto.
- **Resueltos:** tickets Resueltos o Cerrados.

Los valores siempre corresponden a tu empresa, no a otras cuentas cliente.

### 4. Búsqueda y filtros

1. Escribí un código o parte del título en **Buscar por código o título**.
2. Si lo necesitás, elegí estado, nivel de atención o área.
3. Seleccioná **Filtrar**.
4. Para quitar un criterio, usá la cruz de su etiqueta.
5. Para volver al listado completo, seleccioná **Limpiar todos**.

Los tickets se muestran con los actualizados más recientemente primero.

### 5. Crear un ticket

La creación está disponible para `client_operator` y `client_admin`. `client_viewer` solo puede consultar.

En desktop, seleccioná **Nuevo ticket** para abrir el formulario. En mobile, la misma acción abre una pantalla dedicada.

Completá los siguientes pasos:

1. **Tipo de solicitud:** elegí Problema si algo dejó de funcionar o Mejora si necesitás un ajuste.
2. **Título:** resumí el pedido en una frase.
3. **Descripción:** explicá qué ocurre, a quién afecta y qué resultado esperabas.
4. **Área:** elegí la opción más cercana al sistema involucrado.
5. **Impacto:** indicá si afecta a una persona, a un equipo o a toda la operación.
6. **Urgencia informada:** señalá cuánto puede esperar el caso.
7. **¿Podés seguir trabajando?:** indicá si operás normalmente, con una alternativa o si estás bloqueado.
8. **Archivos, imágenes o enlaces:** desplegá la sección opcional si necesitás aportar evidencia.
9. Seleccioná **Crear ticket**.

El ticket se crea con estado Nuevo, nivel de atención Medio y sin responsable. NexOps revisa el contexto y define la prioridad operativa.

### 6. Cómo redactar una buena solicitud

Un buen título identifica el síntoma y el proceso. Por ejemplo:

> Los leads del formulario web no llegan al CRM.

En la descripción incluí:

- qué estabas intentando hacer;
- qué ocurrió;
- qué resultado esperabas;
- desde cuándo sucede;
- cuántas personas o procesos están afectados;
- pasos simples para reproducirlo, si corresponden.

No incluyas contraseñas, tokens, claves, datos de tarjetas ni otra información sensible.

### 7. Selección de área

Las áreas disponibles son:

- Automatizaciones;
- Sistema personalizado;
- Sitios web;
- Agentes IA;
- CRM;
- ERP.

La opción “No estoy seguro” no está disponible actualmente. Si tenés dudas, elegí el área más cercana y explicalo en la descripción.

### 8. Enlaces y adjuntos

Durante la creación podés agregar hasta tres enlaces y hasta tres imágenes.

- Usá enlaces completos que comiencen con `https://` o `http://`.
- Adjuntá capturas que ayuden a entender el caso.
- Revisá que las imágenes no contengan contraseñas ni datos sensibles.

Los adjuntos son privados y solo pueden abrirlos usuarios autorizados para ese ticket. Actualmente no se pueden agregar nuevos adjuntos desde los mensajes posteriores.

### 9. Seguimiento de estado, responsable y próximo paso

Abrí un ticket para consultar:

- **Estado:** momento actual del flujo.
- **Nivel de atención:** prioridad asignada por NexOps.
- **Responsable:** persona del equipo NexOps asignada o “por asignar”.
- **Última actualización:** fecha del último movimiento.
- **Próximo paso:** orientación calculada a partir del estado.

El próximo paso no es un texto escrito manualmente por el equipo. Si necesitás una definición más específica, pedila mediante un mensaje.

### 10. Enviar mensajes

1. Abrí el ticket.
2. Buscá la sección **Conversación**.
3. Escribí el mensaje en **Escribí un mensaje**.
4. Seleccioná **Enviar mensaje**.

Los mensajes del cliente son públicos para NexOps. `client_viewer` puede leer la conversación, pero no publicar.

Cuando el estado sea **Esperando al cliente**, respondé en esa conversación. Si un ticket figura **Resuelto** y el problema continúa, explicalo allí; NexOps decidirá la reapertura y actualizará el estado.

### 11. Consultar historial

En el detalle, desplegá **Historial**. Allí se registran la creación y los cambios relevantes, como comentarios, estado, prioridad y asignación.

El historial es informativo. Los mensajes internos de coordinación NexOps no son visibles en el Portal Cliente.

### 12. Emails de seguimiento

El creador original del ticket puede recibir emails cuando:

- NexOps publica una respuesta pública;
- NexOps cambia realmente el estado.

Otros usuarios de la empresa no reciben automáticamente esos avisos. Los emails complementan a la plataforma; el ticket sigue siendo la fuente principal de información.

### 13. Gestión de usuarios

Todos los roles cliente pueden abrir **Usuarios** y consultar los miembros de su empresa.

`client_admin` también puede crear un usuario:

1. Abrí **Usuarios**.
2. Completá nombre, email, cargo, contraseña inicial y rol.
3. Seleccioná **Invitar usuario**.
4. Entregá la contraseña inicial por un canal seguro.

Aunque el botón dice “Invitar usuario”, la cuenta se crea directamente. No se envía un enlace de invitación. El Portal Cliente no permite actualmente editar ni eliminar usuarios.

### 14. Bloqueo de acceso

No existe recuperación automática de contraseña en el login.

Si no podés ingresar:

1. verificá que el email esté escrito correctamente;
2. confirmá que no haya espacios al copiar la contraseña;
3. no pruebes credenciales de otra persona;
4. durante el piloto, usá el canal de WhatsApp acordado únicamente para bloqueo de acceso o caída total.

Un administrador autorizado deberá gestionar el acceso. No envíes tu contraseña por WhatsApp, email ni dentro de un ticket.

## Parte B — Equipo NexOps

### 1. Acceso al Backoffice

1. Abrí <https://soporte.nexopstech.com>.
2. Ingresá con tu cuenta interna individual.
3. La plataforma te dirigirá al Backoffice.

Los roles internos son `agent`, `team_lead` y `platform_admin`.

### 2. Cola multiempresa

La pantalla **Tickets** es la vista operativa principal. Muestra casos de todas las empresas y cuatro indicadores:

- activos;
- prioridad alta o crítica;
- esperando al cliente;
- empresas.

Cada fila presenta empresa, estado, prioridad, área, responsable, próximo paso y última actualización.

### 3. Búsqueda y filtros

Podés buscar por código o título y filtrar por:

- estado;
- área;
- prioridad;
- empresa;
- responsable o Sin asignar.

Usá los filtros para separar tickets nuevos, casos críticos, pedidos de una cuenta o trabajo pendiente de asignación.

### 4. Analizar un ticket

Al abrir el detalle, revisá antes de actuar:

- empresa y solicitante;
- descripción y contexto informado;
- impacto, urgencia y continuidad incluidos en la descripción;
- conversación;
- responsable actual;
- estado y prioridad;
- historial.

Los enlaces y adjuntos iniciales quedan asociados al ticket, pero el detalle actual del Backoffice no los muestra. Si esa evidencia es necesaria para operar el caso, pedí al cliente que incluya el dato indispensable en un mensaje público, sin trasladar información sensible a canales no autorizados.

### 5. Asignación, prioridad y estado

En **Gestión operativa**:

1. elegí el estado correcto;
2. asigná la prioridad operativa;
3. seleccioná un responsable o Sin asignar;
4. seleccioná **Guardar cambios**.

`agent`, `team_lead` y `platform_admin` pueden realizar estas acciones. Cada cambio real queda en el historial.

La prioridad debe reflejar impacto, continuidad, urgencia, riesgo y alcance. No copies automáticamente la urgencia informada por el cliente.

### 6. Uso correcto de los estados

- **Nuevo:** todavía no fue evaluado. Revisalo y pasalo a En análisis cuando comience la clasificación.
- **En análisis:** se está comprendiendo el problema o definiendo la solución.
- **En progreso:** existe trabajo activo.
- **Esperando al cliente:** hace falta información o validación externa. Publicá antes una respuesta clara indicando qué necesitás.
- **Resuelto:** la solución fue aplicada y se espera confirmación o cierre.
- **Cerrado:** no quedan acciones pendientes.

La herramienta permite seleccionar estados sin una secuencia obligatoria. El criterio operativo del equipo debe evitar saltos injustificados. Si el cliente informa que el problema continúa, NexOps puede volver el caso a En análisis o En progreso.

### 7. Respuesta pública

Usá **Responder al cliente** para toda comunicación que la empresa deba leer:

- preguntas;
- avances relevantes;
- instrucciones;
- solución aplicada;
- solicitud de validación;
- explicación del próximo paso.

Una respuesta pública de NexOps genera un email al creador original del ticket, siempre que el destinatario sea válido y no sea la misma cuenta que responde.

### 8. Nota interna

Usá **Agregar nota interna** solo para coordinación NexOps:

- hipótesis de análisis;
- decisiones operativas;
- coordinación entre responsables;
- contexto que no corresponde publicar al cliente.

La nota interna se muestra diferenciada en el Backoffice, no aparece en el Portal Cliente y no genera emails.

No uses una nota interna para información que el cliente necesita conocer.

### 9. Historial

Desplegá **Historial** para revisar creación, comentarios y cambios de workflow. Antes de reasignar, reabrir o cerrar, comprobá las decisiones anteriores.

Guardar el mismo estado no genera un nuevo evento de estado. Los cambios reales de prioridad y asignación sí quedan registrados, aunque no generan emails.

### 10. Cierre del ticket

1. Publicá una respuesta externa con la solución o resultado.
2. Marcá el ticket como **Resuelto**.
3. Esperá la confirmación del cliente cuando corresponda.
4. Si confirma, cambialo a **Cerrado**.
5. Si informa que el problema continúa, reabrilo como **En análisis** o **En progreso**.

El cliente no puede cambiar el estado directamente y no existe cierre automático.

### 11. Empresas y usuarios

Todos los roles internos pueden consultar las empresas, sus tickets y los directorios visibles.

- `agent` opera tickets, pero no crea ni edita empresas o usuarios.
- `team_lead` y `platform_admin` pueden crear y actualizar empresas y usuarios.
- No existe eliminación de usuarios desde la interfaz.

Al crear una cuenta, el sistema solicita una contraseña inicial. Entregala por un canal seguro y nunca la registres en un ticket.

### 12. Notificaciones generadas

El equipo NexOps recibe aviso cuando:

- un cliente crea un ticket;
- un cliente publica un mensaje externo.

El creador del ticket recibe aviso cuando:

- NexOps publica una respuesta externa;
- NexOps cambia realmente el estado.

No se envían avisos por notas internas, prioridad ni asignación. El email es un apoyo; confirmá siempre que la acción quedó guardada en la plataforma.

### 13. Buenas prácticas operativas

- Asigná responsable y estado después del análisis inicial.
- Explicá públicamente qué necesita hacer el cliente cuando uses Esperando al cliente.
- No cierres un ticket sin dejar una respuesta comprensible.
- Evitá notas internas con credenciales o secretos.
- Mantené la conversación principal dentro del ticket.
- Revisá el historial antes de cambiar una decisión previa.
- Usá títulos y respuestas comprensibles para personas no técnicas.

## Parte C — Reglas de uso

1. **No compartir contraseñas.** Cada persona debe usar su cuenta individual.
2. **No incluir información sensible.** No publiques credenciales, tokens, claves, datos de tarjetas ni secretos en tickets, mensajes, notas o adjuntos.
3. **Hablar con el cliente mediante mensajes públicos.** Todo dato que el cliente necesite debe estar en la conversación externa.
4. **Reservar notas internas para coordinación NexOps.** Nunca asumir que una nota interna llegará al cliente.
5. **Mantener el flujo actualizado.** NexOps debe revisar estado, responsable y prioridad. El próximo paso visible se deriva del estado; los detalles específicos deben explicarse en una respuesta pública.
6. **Usar evidencia segura.** Antes de adjuntar una imagen, ocultá datos personales o sensibles que no sean necesarios.
7. **Usar WhatsApp solo como contingencia durante el piloto.** Reservarlo para bloqueo de acceso o caída total; el seguimiento normal debe permanecer en el Centro de Soporte NexOps.
8. **Tomar el ticket como registro oficial.** Los emails notifican, pero la conversación, el estado y el historial de la plataforma son la referencia operativa.
