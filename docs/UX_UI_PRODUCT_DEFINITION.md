# Definición de producto UX/UI — Ticketera NexOps

## 1. Alcance y condición de este documento

Este documento define la dirección canónica de producto, navegación, jerarquías y componentes para la Ticketera NexOps. Es la referencia previa a cualquier cambio de interfaz. La auditoría se realizó sobre el commit `adcbd873e50d9fdc4228cea1331e4e5d8e3fa4a1`, el código local y el despliegue operativo en `https://sdnexops.vercel.app`.

Esta fase es exclusivamente documental. No modifica interfaz, lógica, esquema, datos, Supabase ni despliegues.

## 2. Propósito del producto

La Ticketera NexOps es una herramienta operativa compartida para registrar, comprender, priorizar y resolver solicitudes entre una empresa cliente y NexOps. Debe reducir ambigüedad, hacer visible el próximo paso y conservar una conversación trazable sin obligar a ninguna de las partes a interpretar datos técnicos.

El producto tiene dos experiencias diferenciadas sobre el mismo ticket:

- **Portal cliente:** reportar una necesidad, explicar su impacto y urgencia, aportar evidencia, seguir el avance y conversar con NexOps.
- **Backoffice NexOps:** ordenar la demanda multiempresa, evaluar prioridad operativa, asignar responsables, conducir el workflow y comunicarse con el cliente o internamente.

Principios rectores:

1. La operación tiene prioridad sobre la ornamentación.
2. Cada pantalla debe responder qué pasó, quién actúa y qué sigue.
3. El cliente aporta contexto de negocio; NexOps toma decisiones operativas.
4. La conversación es el centro del ticket; la auditoría es soporte.
5. Los mismos conceptos se nombran y representan igual en todo el producto.
6. Toda información técnica visible se traduce a español comprensible.

## 3. Roles y capacidades

| Rol de producto | Rol técnico actual | Capacidades canónicas |
| --- | --- | --- |
| Administrador cliente | `client_admin` | Crear y seguir tickets, comentar, ver miembros de su empresa y administrar accesos cliente. |
| Operador cliente | `client_operator` | Crear y seguir tickets, comentar y consultar el directorio permitido. |
| Lector cliente | `client_viewer` | Consultar tickets y conversación visible, sin crear ni comentar. |
| Agente NexOps | `agent` | Ver cola multiempresa, responder, escribir notas internas, asignar y actualizar estado/prioridad. |
| Líder NexOps | `team_lead` | Capacidades de agente más supervisión operativa y administración del equipo según autorización. |
| Administrador de plataforma | `platform_admin` | Administración global de operación, empresas, usuarios y configuración autorizada. |

Reglas transversales:

- Un cliente nunca ve información, adjuntos, comentarios ni usuarios de otra empresa.
- Una nota interna nunca se muestra en el portal cliente.
- Los controles no autorizados no deben aparecer como acciones disponibles.
- El nombre visible del rol siempre se presenta en español; el identificador técnico queda fuera de la interfaz.

## 4. Arquitectura de información

### 4.1 Objetos principales

1. **Ticket:** unidad central de trabajo.
2. **Conversación:** intercambio cronológico visible y notas internas diferenciadas.
3. **Empresa:** contexto contractual y operativo del cliente.
4. **Usuario:** identidad, rol y pertenencia.
5. **Evidencia:** adjuntos y enlaces asociados al ticket.
6. **Historial:** auditoría secundaria de cambios relevantes.

### 4.2 Jerarquía global

- Nivel 1: experiencia según rol — Portal cliente o Backoffice NexOps.
- Nivel 2: áreas funcionales estables de navegación.
- Nivel 3: listado o workspace.
- Nivel 4: detalle del objeto y acciones contextuales.

No se deben mezclar en una misma superficie la operación diaria, la administración de cuentas y la configuración de usuarios salvo que exista un contexto claro de empresa.

## 5. Navegación canónica

### 5.1 Portal cliente

Navegación principal:

1. **Tickets** — inicio operativo y listado.
2. **Usuarios** — visible según permisos; la administración se habilita solo para administradores cliente.

Acciones globales:

- **Crear ticket** como acción primaria.
- Perfil/empresa y cierre de sesión como utilidades, no como contenido principal.

El portal no necesita un dashboard separado para V1. La pantalla Tickets actúa como inicio y combina un resumen compacto con el listado. Las métricas deben ayudar a actuar, no desplazar la tabla.

### 5.2 Backoffice NexOps

Navegación principal:

1. **Tickets** — cola operativa multiempresa e inicio del backoffice.
2. **Empresas** — directorio y workspace por cuenta.
3. **Equipo** — usuarios internos; evita el nombre genérico “Usuarios”, que puede confundirse con usuarios cliente.

Dentro de una empresa:

- Resumen de cuenta.
- Tickets de la empresa.
- Usuarios cliente.
- Configuración autorizada.

Para V1 no se crea un dashboard independiente: la cola incluye indicadores operativos compactos. Un dashboard analítico separado se evalúa en P2 si aporta decisiones distintas a la cola.

### 5.3 Comportamiento responsive de la navegación

- Desktop: sidebar fija y compacta.
- Tablet: sidebar colapsable o rail, sin competir con el contenido.
- Mobile: barra superior compacta con menú; nunca una tarjeta de navegación completa antes del contenido.
- La acción primaria debe permanecer accesible sin duplicarse de forma confusa.

## 6. Estructura canónica del ticket

Todo ticket debe presentar, como mínimo:

| Grupo | Campos |
| --- | --- |
| Identidad | Código, título, empresa, solicitante y fecha de creación. |
| Contexto cliente | Descripción, impacto, continuidad de trabajo, urgencia informada, área o “No estoy seguro”, tipo de solicitud, enlaces y adjuntos. |
| Operación NexOps | Estado, prioridad operativa, responsable y próximo paso. |
| Seguimiento | Última actualización, conversación e historial. |

Definiciones:

- **Impacto:** alcance de la afectación declarado por el cliente: Individual, Parcial o General.
- **Continuidad de trabajo:** respuesta del cliente a “¿Podés seguir trabajando?” para distinguir operación normal, alternativa disponible o trabajo detenido.
- **Urgencia informada:** rapidez con la que el cliente necesita atención. No define automáticamente la prioridad.
- **Prioridad operativa:** nivel de atención definido exclusivamente por NexOps combinando impacto, continuidad, urgencia, alcance, riesgo, dependencias y capacidad.
- **Próximo paso:** texto breve con responsable NexOps o Cliente y fecha estimada opcional.

El encabezado o resumen persistente de un ticket debe responder sin desplazamiento excesivo:

- cuál es el estado;
- quién es responsable;
- cuándo se actualizó;
- cuál es el próximo paso.

## 7. Modelo de estados

Estados canónicos de V1:

| Estado | Significado | Responsable esperado | Transiciones habituales |
| --- | --- | --- | --- |
| Nuevo | Ingresó y todavía no fue evaluado. | NexOps | En análisis. |
| En análisis | NexOps comprende alcance, impacto y solución posible. | NexOps | En progreso, Esperando al cliente, Resuelto. |
| En progreso | Hay trabajo activo sobre el ticket. | NexOps | Esperando al cliente, Resuelto, En análisis. |
| Esperando al cliente | NexOps necesita información, validación o decisión del cliente. | Cliente | En análisis, En progreso, Resuelto. |
| Resuelto | NexOps considera completada la solución y espera validación o cierre. | Cliente/NexOps | Cerrado, En progreso. |
| Cerrado | El cliente confirmó la resolución y NexOps cerró el trabajo. | Ninguno | Reapertura explícita si el problema continúa. |

Reglas de presentación:

- Los estados siempre se muestran en español.
- El estado incluye texto y, cuando ayude, icono; el color es refuerzo, nunca único canal.
- La interfaz debe explicar quién tiene la próxima acción.
- Los cambios sensibles deben generar historial legible, por ejemplo “Agente Staging cambió el estado a En progreso”, nunca `in_progress`.

### 7.1 Resolución, confirmación y reapertura

1. NexOps marca el ticket como **Resuelto** cuando considera completada la solución.
2. El cliente puede confirmar la resolución o indicar que el problema continúa.
3. Si el problema continúa, el ticket se reabre y vuelve al flujo operativo de NexOps.
4. NexOps pasa el ticket a **Cerrado** cuando la resolución queda confirmada.
5. La V1 no cierra tickets automáticamente por cantidad de días.

## 8. Urgencia versus prioridad

La separación es obligatoria y queda definida para V1:

- **El cliente declara impacto, continuidad de trabajo y urgencia informada.** La interfaz debe explicar que esta información ayuda a NexOps a evaluar el caso.
- **NexOps define prioridad.** El cliente puede verla como información, pero no seleccionarla ni editarla.

### 8.1 Impacto informado por el cliente

- **Individual:** afecta a una persona.
- **Parcial:** afecta a un equipo o proceso.
- **General:** afecta a toda la empresa u operación crítica.

Pregunta complementaria obligatoria: **¿Podés seguir trabajando?**

- **Sí, normalmente.**
- **Sí, con una alternativa.**
- **No, el trabajo está detenido.**

### 8.2 Urgencia informada

- **Puede esperar.**
- **Necesito resolverlo hoy.**
- **Necesito atención inmediata.**

La urgencia informada es un dato declarado por el cliente y no define automáticamente la prioridad.

### 8.3 Prioridad operativa

NexOps asigna una de estas prioridades:

- **Baja.**
- **Media.**
- **Alta.**
- **Crítica.**

En el portal cliente se presenta bajo el rótulo **“Nivel de atención asignado por NexOps”**. El cliente puede consultarla, pero no modificarla. La V1 no implementa cálculo de prioridad ni SLA automáticos.

### 8.4 Próximo paso

Cuando corresponda, el próximo paso contiene:

- texto breve;
- responsable: **NexOps** o **Cliente**;
- fecha estimada opcional.

Debe estar visible en el listado y en el detalle. NexOps lo define y actualiza como parte del seguimiento operativo.

## 9. Flujo canónico de creación

### 9.1 Orden del formulario cliente

1. Tipo de solicitud: problema o mejora.
2. Título breve.
3. Descripción guiada: qué ocurre, a quién afecta y qué resultado esperaba.
4. Impacto: Individual, Parcial o General.
5. Continuidad: **¿Podés seguir trabajando?**
6. Urgencia informada: Puede esperar, Necesito resolverlo hoy o Necesito atención inmediata.
7. Área, incluyendo **No estoy seguro**.
8. Evidencia opcional: enlaces y adjuntos.
9. Revisión y envío.

No se solicita prioridad al cliente.

Si el cliente selecciona **No estoy seguro**, el ticket se muestra como **Por clasificar** hasta que NexOps asigne el área. “Por clasificar” es un estado transitorio de clasificación y no un área ficticia permanente.

### 9.2 Comportamiento

- Desktop: panel lateral amplio o modal sobrio, siempre que no oculte contexto necesario.
- Mobile: página completa con encabezado, volver/cancelar, progreso simple y acción final visible.
- Guardar debe mostrar estado de envío y evitar doble submit.
- Los errores se asocian al campo y se resumen arriba cuando corresponda.
- Tras crear: confirmar código, estado inicial, responsable actual y próximo paso esperado.

## 10. Estructura del listado

### 10.1 Desktop

Se mantiene una tabla densa. Orden canónico de columnas:

- Ticket: código + título.
- Empresa, solo en backoffice.
- Estado.
- Responsable.
- Próximo paso.
- Prioridad, principalmente backoffice; visible en portal como dato informado.
- Última actualización.

Área puede permanecer como columna o filtro secundario según ancho. La fila completa es clickeable y se conserva **Abrir** como acción secundaria explícita: apoya la descubribilidad y la accesibilidad sin competir visualmente con la interacción principal de la fila.

Reglas:

- Toda la fila abre el detalle y tiene foco de teclado visible.
- **Abrir** ofrece un destino explícito y accesible, con jerarquía visual secundaria respecto de la fila.
- Los controles internos de la fila, si existen, no deben disparar la navegación.
- Orden por defecto: elementos que requieren acción primero y luego actualización descendente.
- Filtros activos visibles como chips removibles; acción clara para limpiar.
- El resultado informa cantidad y criterio de orden.
- Desktop conserva tabla; no se reemplaza por tarjetas grandes.

### 10.2 Mobile

- No se fuerza la tabla completa con desplazamiento horizontal como experiencia principal.
- Cada ticket se presenta como fila apilada compacta, no como tarjeta ornamental.
- Primera línea: código, estado y prioridad cuando corresponda.
- Segunda: título.
- Tercera: responsable, última actualización y próximo paso resumido.
- Filtros en panel accesible con cantidad de filtros activos.

## 11. Estructura del detalle

Orden canónico:

1. Encabezado compacto con volver, código, título y acciones contextuales.
2. Barra de situación: estado, responsable, última actualización y próximo paso.
3. Conversación como columna principal.
4. Contexto y evidencia en bloque secundario, expandible cuando sea extenso.
5. Panel operativo NexOps con estado, prioridad y asignación; sticky solo en desktop.
6. Historial colapsado por defecto.

En portal, el cliente no ve controles de workflow ni notas internas. En backoffice, la decisión de visibilidad al comentar debe ser explícita y difícil de confundir.

## 12. Conversación y notas internas

La conversación es el contenido principal del detalle:

- Orden cronológico consistente; V1 usará más antiguo arriba y compositor al final.
- Autor, pertenencia (Cliente/NexOps), fecha y visibilidad claramente identificados.
- Comentarios externos y notas internas deben diferenciarse por etiqueta, icono, borde y texto; no solo por color.
- El compositor de backoffice debe ofrecer acciones separadas: **Responder al cliente** y **Agregar nota interna**.
- No se usa un selector entre comentario público e interno: la acción elegida define el destino y mantiene su contexto visible durante la escritura y confirmación.
- Antes de publicar una nota interna o respuesta externa debe quedar visible el destino.
- Adjuntos de mensajes se integran en el mismo hilo cuando se implementen.
- El estado vacío debe invitar a iniciar la conversación con contexto útil.

## 13. Historial

El historial es secundario y se presenta colapsado bajo “Ver historial”. Al expandir:

- agrupa eventos por fecha;
- usa frases completas en español;
- identifica actor, acción, valor anterior/nuevo cuando aporte y fecha;
- evita duplicar comentarios completos que ya aparecen en la conversación;
- mantiene trazabilidad de creación, estado, prioridad, asignación y cambios relevantes.

## 14. Notificaciones y recuperación de acceso

- Las notificaciones no bloquean la implementación estructural P0.
- Las notificaciones por email se implementarán como P1.
- La recuperación de contraseña permanece como pendiente técnico independiente y no debe mezclarse con el alcance UX/UI estructural.
- La V1 no necesita automatizaciones de SLA para enviar notificaciones.

## 15. Responsive

Breakpoints de comportamiento, no solo de tamaño:

- **Desktop (≥ 1024 px):** sidebar, tabla, dos columnas en detalle y panel operativo sticky.
- **Tablet (768–1023 px):** navegación colapsable, tabla con columnas priorizadas y detalle en una columna.
- **Mobile (< 768 px):** barra superior, listados apilados compactos, filtros en panel, creación en página completa y acciones de ancho completo cuando sea necesario.

Requisitos:

- Sin texto o controles ilegibles por escalado.
- Sin dependencia de scroll horizontal para el flujo principal.
- Objetivos táctiles mínimos de 44 × 44 px.
- El teclado virtual no debe ocultar la acción principal del formulario.
- El orden visual debe coincidir con el orden de lectura y foco.

## 16. Sistema visual

Se mantiene la identidad actual: tipografía de marca, superficies claras, bordes suaves y violeta NexOps. Se cambia la proporción y el uso.

### 16.1 Dirección

- Violeta reservado para acción primaria, foco, navegación activa y acentos pequeños.
- Neutros para estructura, filtros y acciones secundarias.
- Reducir gradientes, transparencias, blur y sombras profundas en superficies operativas.
- Reducir radios excesivos; reservar formas muy redondeadas para pills, no para todos los contenedores.
- Reducir aproximadamente 20–30 % el espacio vertical en shell, encabezados, tarjetas, formularios y secciones.
- Evitar tarjetas métricas grandes cuando un resumen en línea cumple la misma función.

### 16.2 Escala propuesta

- Espaciado base: 4 px; usos frecuentes 8, 12, 16, 20, 24 y 32 px.
- Contenedor operativo: padding 16–20 px desktop, 12–16 px mobile.
- Fila de tabla: objetivo 52–64 px según contenido.
- Radio: 8–12 px en campos y paneles; 999 px solo para pills.
- Sombras: una escala sutil; bordes y contraste definen la mayoría de superficies.

### 16.3 Semántica

Estado, prioridad y visibilidad combinan:

- texto legible;
- icono o forma cuando aporte;
- color semántico con contraste suficiente;
- vocabulario consistente.

## 17. Estados de carga, error, éxito y vacío

### Carga

- Skeletons con la geometría real del contenido para listados y detalle.
- Botones muestran progreso y se deshabilitan durante el envío.
- Evitar reemplazar toda la pantalla si solo se actualiza una sección.

### Error

- Mensaje en español, específico y accionable.
- Error de campo junto al control y resumen cuando hay varios.
- Acciones de reintento o retorno seguras.
- No mostrar códigos internos como mensaje principal.

### Vacío

- Distinguir “sin datos” de “sin resultados para estos filtros”.
- Explicar por qué está vacío y ofrecer una acción pertinente.
- Usar contenedores compactos; no convertir todo vacío en una tarjeta de gran altura.

### Éxito

- Confirmación discreta y persistente el tiempo suficiente para leerse.
- En cambios operativos, mostrar el nuevo estado y próximo paso.

## 18. Accesibilidad

Objetivo mínimo: WCAG 2.2 AA.

- Estructura semántica con un `h1` por pantalla y jerarquía de títulos sin saltos arbitrarios.
- Navegación principal identificable y enlace para saltar al contenido.
- Foco visible con contraste suficiente en todos los elementos interactivos.
- La fila clickeable debe ser operable con teclado y anunciar su destino.
- Modales con nombre accesible, foco inicial, trampa de foco y devolución del foco al disparador.
- Etiquetas persistentes; placeholders no sustituyen labels.
- Errores asociados mediante `aria-describedby` y avisos dinámicos con `aria-live`.
- Estados, prioridades y visibilidades comprensibles sin color.
- Contraste AA para texto y controles, incluido violeta sobre fondos claros.
- Fechas con formato humano y valor completo accesible.
- Respeto por `prefers-reduced-motion`.

## 19. Componentes reutilizables canónicos

### Reutilizar con ajustes

- `AppShell`: mantener como marco común; reducir altura, ornamentación y adaptar navegación mobile.
- `SectionCard`: conservar como sección semántica; crear variantes `plain`, `bordered` y `collapsible` más densas.
- `StatCard`: conservar solo para indicadores accionables; añadir variante compacta.
- `StatusPill`, `PriorityPill`, `AreaPill`, `RolePill`: mantener etiquetas centralizadas; añadir iconografía/semántica accesible.
- `EmptyState`: mantener con variantes compacta y contextual.
- `TimelineDate`: conservar, agregando fecha accesible completa.
- `TicketTable` y `UserTable`: conservar lógica y datos; refactorizar interacción, columnas, responsive y densidad.
- Formularios y `TicketEvidenceFields`: conservar primitivas y validaciones; reorganizar campos y mensajes.

### Refactor necesario

- `PortalTicketModal` / `AppModal`: separar patrón modal desktop de ruta/página completa mobile y completar gestión de foco.
- `TicketTable`: fila completa clickeable, acción secundaria **Abrir**, próximo paso y variante mobile.
- `CreateTicketForm`: eliminar prioridad cliente; agregar impacto, urgencia y “No estoy seguro”.
- `TicketWorkflowForm`: presentar términos en español, incorporar próximo paso y mejorar feedback de guardado.
- Conversación: extraer componentes `ConversationThread`, `MessageItem` y `CommentComposer` con visibilidad inequívoca.
- Historial: extraer `TicketHistory` colapsable y normalizar mensajes traducidos.
- Metadatos duplicados en detalles: crear `TicketSituationBar`, `TicketContext` y `MetaList`.
- Filtros duplicados: crear `TicketFilters` con chips activos y variantes portal/backoffice.

### Componentes nuevos previstos

- `MobileHeader` / navegación colapsable.
- `TicketSituationBar`.
- `NextStep`.
- `ImpactField` y `UrgencyField`.
- `ResponsiveTicketList`.
- `InlineNotice` y `FormErrorSummary`.
- `LoadingSkeleton` por superficie.
- `CollapsibleSection`.

## 20. Auditoría de la implementación actual

Leyenda: **Cumple**, **Cumple parcialmente**, **No cumple**. Prioridad **P0** bloquea la dirección estructural; **P1** mejora el flujo principal; **P2** completa calidad y escalabilidad.

| Criterio | Estado | Prioridad | Riesgo actual | Propuesta |
| --- | --- | --- | --- | --- |
| Dos experiencias diferenciadas | Cumple | P0 | Bajo | Mantener rutas y permisos separados. |
| Navegación cliente simple | Cumple | P1 | Bajo | Mantener Tickets y Usuarios; compactar shell. |
| Navegación backoffice clara | Cumple parcialmente | P1 | “Usuarios” es ambiguo y el sidebar mobile domina la pantalla. | Renombrar a Equipo y crear navegación mobile compacta. |
| Cliente describe impacto | No cumple | P0 | NexOps recibe contexto incompleto y no estructurado. | Agregar niveles Individual, Parcial y General, más continuidad de trabajo. |
| Cliente declara urgencia | No cumple | P0 | Urgencia se confunde con prioridad. | Agregar la escala aprobada de urgencia informada y explicar que no define prioridad. |
| NexOps define prioridad | No cumple | P0 | El cliente selecciona prioridad en creación. | Eliminar ese control del portal y conservarlo solo en backoffice. |
| Área incluye “No estoy seguro” | No cumple | P0 | El cliente fuerza una clasificación posiblemente incorrecta. | Mostrar Por clasificar hasta asignación NexOps, sin crear un área ficticia. |
| Ticket muestra estado | Cumple | P0 | Bajo | Mantener etiqueta textual y mejorar semántica accesible. |
| Ticket muestra responsable | Cumple parcialmente | P0 | Está en tabla/resumen, pero no siempre en una barra de situación clara. | Unificar en `TicketSituationBar`. |
| Ticket muestra última actualización | Cumple | P0 | Bajo | Mantener y normalizar formato accesible. |
| Ticket muestra próximo paso | No cumple | P0 | No queda claro quién debe actuar ni qué sigue. | Incorporar texto, responsable NexOps/Cliente y fecha estimada opcional. |
| Tabla en desktop | Cumple | P0 | Bajo | Mantener con mayor densidad y columnas priorizadas. |
| Fila completa clickeable | No cumple | P0 | Solo el ticket y el botón Abrir navegan; menor velocidad y accesibilidad. | Convertir la fila en objetivo interactivo de teclado y mouse, conservando Abrir como acción secundaria explícita. |
| Listado mobile operativo | No cumple | P1 | La tabla depende de scroll horizontal. | Variante apilada compacta específica para mobile. |
| Filtros consistentes | Cumple parcialmente | P1 | Código duplicado; no muestra chips ni conteo activo. | Extraer `TicketFilters` y hacer visibles los filtros activos. |
| Conversación como foco principal | Cumple parcialmente | P0 | Está destacada, pero el resumen aparece antes y ocupa mucho espacio. | Subir barra de situación y dar mayor protagonismo al hilo. |
| Notas internas diferenciadas | Cumple parcialmente | P0 | Hay etiqueta y selector, pero la diferencia visual/acción puede confundirse. | Separar “Responder al cliente” de “Agregar nota interna”. |
| Historial secundario y colapsable | No cumple | P1 | Siempre está expandido y alarga el detalle. | Colapsar por defecto y agrupar eventos. |
| Valores técnicos en español | No cumple | P0 | El historial muestra `in_progress` y `high`; “Issue”, “Workflow” y “Overview” permanecen en inglés. | Traducir en origen de presentación y normalizar mensajes históricos. |
| Creación mobile como página | No cumple | P0 | El mismo modal con scroll se usa en todos los tamaños. | Ruta/página completa en mobile; modal o panel en desktop. |
| Densidad 20–30 % mayor | No cumple | P1 | Headers, cards, radios y separaciones elevan el scroll y reducen información visible. | Aplicar nueva escala de spacing, padding, radios y alturas. |
| Violeta solo como acento | Cumple parcialmente | P1 | Gradientes, navegación activa, botones y fondos lo usan con frecuencia. | Reservarlo para foco y acción primaria; usar neutros en estructura. |
| Apariencia operativa, no ornamental | No cumple | P1 | Abundan tarjetas grandes, sombras, blur, gradientes y radios de 22–32 px. | Simplificar superficies y jerarquía mediante tipografía, borde y espacio. |
| Estado no depende solo del color | Cumple parcialmente | P1 | Las pills tienen texto, pero falta icono/semántica y contraste auditado. | Agregar refuerzo no cromático y pruebas de contraste. |
| Carga contextual | No cumple | P1 | No se observan skeletons ni estados de carga por superficie. | Definir loading states por ruta y mutación. |
| Errores accionables y de campo | Cumple parcialmente | P1 | Existen banners generales, pero falta asociación por campo y reintento consistente. | Crear resumen y errores inline accesibles. |
| Estados vacíos | Cumple parcialmente | P2 | Mensajes útiles, pero visualmente grandes y sin todas las variantes. | Variante compacta y distinción datos/filtros/error. |
| Accesibilidad de modales | Cumple parcialmente | P0 | Escape y cierre existen; no se evidencia diálogo semántico, trampa ni retorno de foco. | Implementar patrón modal accesible completo. |
| Foco y teclado en tablas | No cumple | P0 | No existe interacción de fila ni contrato explícito de foco. | Definir fila/link semántico y foco visible. |
| Responsive de shell | No cumple | P1 | En mobile el sidebar completo precede el contenido y consume altura. | Reemplazar por header/menú compacto. |
| Gestión empresa/usuarios separada de cola | Cumple | P1 | Bajo | Mantener separación y reducir densidad de formularios largos. |
| Componentes compartidos | Cumple parcialmente | P1 | Hay base reutilizable, pero filtros, metadatos y conversación se duplican. | Extraer componentes de dominio antes de retoques de pantalla. |

## 21. Hallazgos estructurales e inconsistencias

### Hallazgos principales

1. La separación de portal y backoffice, el aislamiento por rol y la tabla desktop son una base sólida.
2. El modelo actual mezcla información declarada por el cliente con decisiones operativas de NexOps.
3. El detalle ya contiene conversación, contexto, workflow e historial, pero la jerarquía no termina de convertirlos en una secuencia operativa.
4. El sistema visual es consistente, aunque sobredimensiona casi todas las superficies.
5. Los componentes compartidos existen; el mayor valor está en refactorizarlos antes de corregir páginas individualmente.

### Inconsistencias concretas

- El formulario cliente pide prioridad, contradiciendo la responsabilidad de NexOps.
- No existen impacto, urgencia ni próximo paso como datos de primera clase.
- “Issue”, “Workflow”, “Overview”, `in_progress` y `high` rompen el criterio de español integral.
- “Usuarios” significa clientes en portal e internos en backoffice.
- El detalle declara que la conversación es foco, pero antepone un resumen voluminoso.
- Historial y conversación compiten en altura, aunque el historial debería ser secundario.
- Las páginas usan tabla en cualquier ancho y modal de creación también en mobile.
- La acción Abrir debe coexistir con la fila clickeable como apoyo de descubribilidad y accesibilidad, con jerarquía visual secundaria.

## 22. Decisiones pendientes

Las decisiones estructurales de impacto, continuidad, urgencia, prioridad, próximo paso, clasificación, reapertura, conversación y notificaciones ya están aprobadas. Permanecen pendientes para fases posteriores:

1. Regla operativa interna con la que NexOps evalúa prioridad; no habrá cálculo ni SLA automático en V1.
2. Diseño técnico de persistencia y migración para los nuevos campos, sin crear un área ficticia.
3. Comportamiento de conversación con alto volumen: paginación o carga incremental.
4. Qué métricas merecen permanecer sobre el listado y cuáles pasan a P2.
5. Plantillas, eventos y destinatarios concretos de notificaciones por email P1.
6. Flujo técnico y visual de recuperación de contraseña, tratado como iniciativa independiente.

## 23. Plan de implementación por etapas

### Etapa 0 — Contratos de producto y datos (P0)

- Traducir las decisiones aprobadas a contratos de impacto, continuidad, urgencia informada, prioridad, próximo paso y área por clasificar.
- Mapear permisos y transiciones de estado.
- Diseñar migración/versionado solo después de aprobación separada.

### Etapa 1 — Fundaciones UI y lenguaje (P0)

- Centralizar traducciones y eliminar valores técnicos visibles.
- Crear tokens de densidad, radio, sombra, foco y color semántico.
- Refactorizar shell, navegación responsive, pills, avisos y estados.
- Incorporar accesibilidad base y pruebas mínimas de componentes críticos.

### Etapa 2 — Flujo cliente (P0/P1)

- Rehacer creación con impacto/urgencia/área incierta y sin prioridad.
- Implementar creación mobile como página.
- Refactorizar listado y detalle cliente con fila clickeable, situación y conversación principal.
- Incorporar confirmación de resolución y reapertura sin cierre automático.

### Etapa 3 — Operación NexOps (P0/P1)

- Refactorizar cola multiempresa, filtros y orden de trabajo.
- Incorporar próximo paso y panel operativo consistente.
- Separar respuestas externas de notas internas.
- Colapsar y traducir historial.
- Preparar puntos de integración para notificaciones por email P1, sin implementarlas en el P0 estructural.

### Etapa 4 — Administración y calidad (P1/P2)

- Densificar empresas y usuarios.
- Completar loading/error/empty/success.
- Validar responsive, teclado, lector de pantalla, contraste y motion.
- Ejecutar pruebas de regresión visual y recorridos por rol.

### Etapa 5 — Analítica opcional (P2)

- Evaluar dashboard separado, SLA, tendencias y métricas solo si agregan decisiones distintas a la cola.

## 24. Archivos previstos para fases de implementación

La lista es orientativa y no implica cambios en esta fase.

Las rutas públicas canónicas de detalle utilizan `ticketCode` como referencia legible:

- `/portal/tickets/[ticketCode]`
- `/backoffice/tickets/[ticketCode]`

El código es la referencia pública de la URL; el UUID continúa siendo el identificador interno y la clave de las relaciones. Las URLs anteriores basadas en UUID mantienen compatibilidad mediante redirección a la ruta canónica. La sesión, los permisos y la autorización multiempresa se validan antes de devolver información del ticket o efectuar la redirección.

### UI y navegación

- `src/app/globals.css`
- `src/components/ui.tsx`
- `src/components/tables.tsx`
- `src/components/forms.tsx`
- `src/components/portal-ticket-modal.tsx`
- `src/components/ticket-evidence-fields.tsx`
- nuevos componentes de dominio bajo `src/components/`

### Portal cliente

- `src/app/portal/layout.tsx`
- `src/app/portal/page.tsx`
- `src/app/portal/tickets/[ticketCode]/page.tsx`
- `src/app/portal/users/page.tsx`
- posible nueva ruta `src/app/portal/tickets/new/page.tsx`

### Backoffice NexOps

- `src/app/backoffice/layout.tsx`
- `src/app/backoffice/queue/page.tsx`
- `src/app/backoffice/tickets/[ticketCode]/page.tsx`
- `src/app/backoffice/companies/page.tsx`
- `src/app/backoffice/companies/[companyId]/page.tsx`
- `src/app/backoffice/users/page.tsx`

### Dominio, acciones y datos — solo tras aprobación separada

- `src/lib/ticketing.ts`
- `src/lib/queries.ts`
- `src/app/actions.ts`
- migración nueva bajo `supabase/migrations/` para campos aprobados; nunca reescribir migraciones aplicadas.

### Pruebas

- pruebas unitarias/de componentes existentes bajo `tests/`
- nuevos recorridos de portal, backoffice, responsive y accesibilidad según la estrategia que se apruebe.

## 25. Criterio de cierre de la dirección UX/UI

La dirección queda lista para implementación cuando:

- las decisiones P0 aprobadas se traducen en contratos verificables de interfaz y datos;
- impacto, urgencia, prioridad y próximo paso tienen definiciones inequívocas;
- portal y backoffice comparten vocabulario y componentes sin mezclar responsabilidades;
- cada flujo tiene jerarquía desktop/mobile acordada;
- los criterios de accesibilidad y estados transitorios forman parte de aceptación;
- todo cambio futuro puede trazarse contra esta definición y su matriz.
