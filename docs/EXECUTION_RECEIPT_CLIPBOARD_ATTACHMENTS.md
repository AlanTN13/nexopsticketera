# Execution Receipt — Adjuntos desde el portapapeles

Fecha: 2026-09-17. Estado: READY_FOR_REVIEW. Rama: `codex/clipboard-attachments`.

## Reconciliación previa

Base verificada contra GitHub: `52ec5ad39d49da4a9d6817a994a5d50a0c51d27b` (main, PR #78). Se creó un worktree desde esa base, sin mezclar los commits de documentación de la copia local anterior. Main volvió a verificarse antes del commit.

Creación usaba inputs `attachment1…3` en `TicketEvidenceFields`; comentarios usaba `commentImages` múltiple con preview propio. Ambos llegaban a `comment-image-validation.ts`: máximo 3 JPG/PNG/WEBP, 10 MiB por archivo, extensión coherente y firma binaria. El nuevo picker compartido mantiene esos nombres y reutiliza exactamente los validadores existentes. Las acciones, Storage, permisos y sanitización del servidor no cambian.

## Resultado

- `Adjuntar archivo` permanece como selector nativo; también se puede pegar con Cmd+V/Ctrl+V en el formulario activo o el área enfocable de adjuntos.
- Selector y pegado agregan a la misma lista con previews y eliminación. Pegar en descripción abre la sección colapsada.
- Evento `paste` estándar; ninguna lectura proactiva ni permiso de clipboard solicitado por la aplicación. Texto/HTML sin archivos conserva el pegado normal.
- Deduplicación SHA-256 del contenido durante la edición, incluso si cambia el nombre. Cola serial para pegados rápidos; envío bloqueado mientras valida, sin activar anticipadamente el guard de doble envío.
- Los archivos se incorporan al `FormData` con el contrato original. El reset del formulario limpia selección, previews y operaciones pendientes; las URLs temporales se liberan al quitar/reset/desmontar.
- Mobile conserva el input nativo de imágenes (incluidas las opciones de cámara que ofrezca el dispositivo). Sin rediseño del resto del formulario ni dependencias de producción nuevas.

## Evidencia

- `npm test`: **51 archivos / 241 pruebas PASS**; 18 pruebas focalizadas de selección/validación.
- `npm run typecheck`: PASS. `npm run lint`: PASS.
- `npm run build -- --webpack`: PASS. Build de producción local; CI ejecuta además el build estándar del repositorio.
- **13 escenarios Chrome PASS** con componentes React reales, wrappers de formulario reales y acción local de captura: selector JPEG, paste PNG/JPEG y preview, pegado repetido, límites, texto sin adjunto, aislamiento de formularios, quitar/reagregar, serialización de bytes/campos, reset, envío durante validación y nuevo intento.
- Incluye **portapapeles real del navegador + atajo de teclado** para PNG. El runner prepara el portapapeles con permisos de QA; la aplicación sólo maneja `paste`.
- [Resultados](evidence/clipboard-attachments/browser-results.json), [creación escritorio](evidence/clipboard-attachments/desktop-ticket.png), [comentario escritorio](evidence/clipboard-attachments/desktop-comment.png), [móvil 390 px](evidence/clipboard-attachments/mobile-ticket.png). Sin errores JavaScript ni desborde móvil.

Harness reproducible en `tests/browser/`: requiere Chrome, Playwright y esbuild disponibles externamente (no agrega paquetes al producto). Desde el root del repo, ejecutar `node tests/browser/clipboard-server.cjs` y luego `node tests/browser/clipboard-check.cjs`; si las herramientas están instaladas fuera del repo, incluir sus directorios `node_modules` en `NODE_PATH`. Servidor de QA en `127.0.0.1:4318`.

## Límites

Las capturas corresponden a un harness local de los componentes reales, no a una sesión productiva. No se validaron Auth/Storage hospedados, cámara física ni Safari/iOS. El servidor conserva su validación independiente y no se modificaron sus operaciones. No hay migraciones. No desplegado ni mergeado.

## Knowledge Delta

La entrada de adjuntos ahora es compartida por creación, comentarios externos y notas internas. MIME/cantidad/tamaño/extensión/firma siguen definidos por el contrato existente; el portapapeles es una segunda fuente de archivos, no un canal alternativo de subida. La deduplicación es local a la selección y desaparece al quitar o reiniciar. PR/commit y estado de CI quedan enlazados en la entrega; producción pendiente de release.

Referencia técnica consultada: [evento paste](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) y [DataTransfer.files](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files).
