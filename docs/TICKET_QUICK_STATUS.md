# Gestión rápida de estados — AlanOS #49

## Contrato y snapshot

Base verificada: `origin/main` 8b6e7d5. Issue AlanTN13/Alanos#49 abierta, sin comentarios. No hay PR concurrente de soporte; Radar y dependencias permanecen fuera de alcance.

El workflow V2 sólo permite cambios por personal interno activo, asignado a la empresa y con Soporte operate/admin; platform_admin conserva su alcance vigente. La “vista del cliente” se implementa en el workspace por empresa del backoffice. El portal cliente mantiene lectura/filtros, ya que sus roles no pueden modificar el workflow individual. No se amplían permisos.

On Hold es un estado abierto/en pausa; no cambia SLA, prioridad, responsable ni reglas de transición (actualmente se permite cualquier destino del catálogo). Se integra en enum, catálogo, detalle, filtros, historial, notificaciones y contadores de abiertos.

## Delivery Team Design

Clasificación: M / R2 (mutación multiempresa y migración aditiva). Arquitectura A1: extender tabla compartida y RPC de workflow existente.

Dirección implementa catálogo, controles de listado, acción y wrapper transaccional. Un único escritor mantiene coherencia entre las superficies estrechamente acopladas. Sin subagentes: el challenge se realiza con pruebas negativas ejecutables sobre PostgreSQL y escenarios de navegador, además de revisión focalizada del diff. No se afirma revisión humana/independiente.

Secuencia: contrato → mutación atómica y catálogo → UI compartida → integración → pruebas de permisos y UX → checks globales → PR/evidencia. Descarga de herramientas y lecturas independientes en paralelo; mutaciones secuenciales.

Selección explícita de visibles/editables; se reinicia al cambiar filtros/ruta. Máximo 100 por operación, sin seleccionar resultados ocultos. El lote se confirma con estado destino, cantidad y botón Aplicar. Un fallo revierte todo el lote; repetir el mismo estado no agrega historial ni email. El lock conserva prioridad y responsable actuales. Notificaciones usan el historial confirmado y son best-effort como en detalle.

## QA / release

Gates: catálogo y filtros; selección móvil/escritorio; cambio individual y masivo; estado actualizado y mensajes; sesión vencida; permiso revocado; lector/cliente/empresa ajena/módulo apagado; lote mixto revierte; histórico/no-op; conservación de responsable/prioridad; lint, typecheck, test, build y CI.

Migración primero (aditiva), luego aplicación. Producción, datos reales, merge que despliegue a producción y migración remota requieren el gate explícito de la issue. Rollback: revertir aplicación; conservar enum y RPC aditivos, sin borrar estados ni datos.

## Cierre de ejecución

Ver [Execution Receipt](EXECUTION_RECEIPT_TICKET_QUICK_STATUS.md) para resultados, evidencia y límite de release. El regreso desde detalle conserva filtros también en la ficha por empresa. La suite incluye regresión de destinos de retorno permitidos.
