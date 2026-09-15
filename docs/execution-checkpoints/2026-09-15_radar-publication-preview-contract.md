# Radar API MVP — paquete editorial y preview

## Contrato integrado

- `prepareRadarPublicationCandidate(candidate)` devuelve `{composition, cover}`. Las tres confirmaciones humanas permanecen `false`. No llama a un generador de imágenes.
- `buildRadarPublicationPackage(run, composition)` prepara la nota completa, todas las fuentes (incluida evidencia/fecha), el PNG y `compositionDigest`. Permite revisar antes de aprobar.
- `buildRadarPublicationBundle({run, composition, approvedBy, approvedAt, callbackUrl, previewToken})` exige estado aprobado (o reintento fallido sin merge), confirmaciones humanas, QA PASS para búsqueda API y firma de la vista previa exacta. Es asíncrono.
- `dispatchRadarPublication({runId,bundle,publicationAttempt})` publica únicamente tras reserva del job por Dirección. Deshabilitado salvo `RADAR_PUBLICATION_ENABLED=true` y credenciales del puente. Los reintentos usan sufijo `-attempt-N`; nunca reinician un PR cerrado/mergeado ni el histórico #73.
- Digest interoperable: SHA-256 de JSON canónico `{schemaVersion:2,article,coverSha256}`. La fecha del artículo es estable (`run.createdAt`); el instante real de aprobación vive en decision.approval. El SHA del PNG se calcula sobre bytes finales. El fingerprint de tema no contiene runId.
- Publicador web exige `packageVersion=2`, PNG real y digest recalculado antes de materializar. Versiones antiguas del paquete del Portal fallan con solicitud de nueva revisión; el CLI editorial independiente conserva su contrato.

## Portada

Cuatro plantillas originales: diagrama editorial, proceso, flujo de datos e interfaz operativa. Título, tema y concepto editorial se incorporan al dibujo; `sharp@0.35.4` convierte y decodifica para comprobar PNG 1600×900. Se declaró dependencia directa (era transitiva opcional de Next). El sitio recibe `cover.png` base64 mediante Git blobs; `coverImage` y `ogImage` terminan en `.png`.

Los gates describen evidencia real: fuente/derechos/afirmaciones y advertencias críticas son atestaciones humanas, semántica de portada proviene de revisión firmada del paquete exacto, formato proviene del PNG decodificado y QA proviene del crítico independiente cuando aplica. Se conserva la evidencia del gate en decision.json.

## Preview privada

Configuración server-only:

- `RADAR_PREVIEW_SECRET`: secreto de firma de al menos 32 caracteres. Como compatibilidad se permite el secreto del callback de publicación; no se devuelve al cliente.
- `RADAR_WEB_PREVIEW_URL`: URL HTTPS exacta del sitio de preview, terminada en `/radar/preview`, sin query ni fragmento. HTTP sólo localhost en desarrollo.

POST autenticado `/api/radar/runs/:runId/preview` comprueba origen, permiso admin y workspace antes de renderizar. Respuesta no-store, firma ligada a usuario/workspace/run/digest durante 30 minutos. El compositor abre una pestaña y envía sólo artículo/PNG/digest, jamás token, mediante `postMessage` con origen exacto, referencia de ventana y nonce. La página del sitio verifica hashes y formato, reutiliza el detalle real de noticias y devuelve acuse sólo tras “Revisé esta vista previa”. Modificar el formulario invalida la vista previa y evita carreras con solicitudes pendientes. La aprobación final exige el token en el backend.

COOP global `same-origin` impedía conservar opener: se ajusta a `same-origin-allow-popups` únicamente en las dos rutas de operación Radar. Las demás rutas mantienen el aislamiento. La página web es estática, noindex/no-store y no persiste el borrador en URL, almacenamiento, Git o servidor público. Abrirla directamente no presenta ninguna nota. No hay PR por búsqueda.

## Corpus y recuperación

El manifiesto conserva `publications` y agrega `sources` completas/`topicFingerprint`; nueva colección `corpus` incluye también artículos editoriales que no generó Radar. El mapa de job fallido restaura la composición aprobada (integración de Dirección). No se permite reintentar un merge no verificado: requiere conciliación. El callback conserva mergeSha incluso en fallo y distingue intentos.

## Evidencia focalizada

- Portal: 12 pruebas de paquete/preview pasan; PNG decodificado, cuatro hashes distintos, determinismo, fuentes completas, cambio de portada/artículo/fuentes, firma ligada a actor/workspace/run y vencimiento, auth/CSRF y fail-closed.
- Web: news:test completo 61/61 y radar:test 5/5; manipulación/downgrade del paquete, transporte exacto y corpus.
- Typecheck Portal sin errores; lint web sin errores. La cubierta de prueba fue renderizada e inspeccionada visualmente a 1600×900.
- La integración de navegador con ambos sitios y los gates globales pertenecen a Dirección. No se desplegó ni publicó contenido real, no se aplicaron migraciones ni se consumió OpenAI.
