# NexOps Contenido · Fase 1

## Alcance cerrado

Esta fase agrega al Portal un módulo por workspace para:

- conectar una cuenta profesional propia mediante la API oficial de Instagram con Facebook Login;
- administrar hasta cinco competidores y tres referencias;
- recolectar perfiles, publicaciones y métricas disponibles;
- conservar identidad de publicaciones, snapshots y trazabilidad por corrida en Supabase;
- ejecutar manualmente con enfriamiento de 60 segundos y dejar instalada una programación semanal, desactivada hasta completar el smoke test real.

Quedan explícitamente fuera análisis, scoring, recomendaciones, estrategia, calendario, briefs, publicación, mensajes, comentarios, anuncios y scraping.

## Contrato oficial de Meta

La integración usa `graph.facebook.com`, fija `META_GRAPH_VERSION` y usa una configuración de Facebook Login for Business (`META_LOGIN_CONFIG_ID`) con un único callback canónico (`META_OAUTH_REDIRECT_URI`). Solicita solo:

- `pages_show_list`;
- `pages_read_engagement`;
- `instagram_basic`;
- `instagram_manage_insights`.

La cuenta propia debe ser Business o Creator, estar vinculada a una Página de Facebook y ser administrada por la persona que autoriza. Business Discovery solo permite observar datos públicos de otras cuentas profesionales. Una cuenta personal, privada o no disponible queda marcada como no compatible; no existe fallback por scraping.

Si una autorización devuelve más de una dupla Página/Instagram, el usuario debe elegirla en el Portal. La aplicación nunca infiere esa selección. Los tokens se cifran con AES-256-GCM y se guardan en una tabla sin grants para usuarios autenticados. El estado OAuth es de un solo uso, vence a los diez minutos y está ligado a actor, empresa y workspace. Una selección pendiente se guarda cifrada y vence a los quince minutos.

## Recolección e idempotencia

`claim_content_sync` serializa una corrida por workspace, reutiliza una `request_key` ya procesada y cierra como fallida una corrida abandonada después de veinte minutos. Cada corrida recibe un lease; tablas y RPC verifican ese lease para que un worker vencido no pueda escribir. Cada cuenta tiene estado propio dentro de la corrida; una falla parcial no descarta datos válidos de las demás.

Las publicaciones se identifican por ID oficial. Un reintento actualiza `last_observed_at`, no duplica la publicación. Los snapshots de métricas solo se agregan cuando cambia su hash; `null` conserva “Meta no entregó el dato” y nunca se transforma en cero. La recolección recorre como máximo 500 Páginas administradas y las 100 publicaciones más recientes por cuenta en cada corrida; cada métrica compatible se consulta de manera aislada para que una métrica no disponible no descarte las demás.

La ruta semanal de Vercel se instala con `CRON_SECRET`, pero solo procesa workspaces con `scheduled_enabled = true`. La migración deja todos en `false`; el primer entorno se habilita únicamente después del OAuth y smoke test real.

## Acción externa necesaria

Para el smoke test, un administrador de NexOps debe crear o elegir la Meta Business App, agregar Instagram API with Facebook Login y Facebook Login for Business, crear la configuración que entrega `config_id`, y registrar exactamente `https://portal.nexopstech.com/api/meta/instagram/callback`. Luego carga en Vercel `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_LOGIN_CONFIG_ID`, `META_OAUTH_REDIRECT_URI` y `META_TOKEN_ENCRYPTION_KEY`. Durante Standard Access, la cuenta probada debe pertenecer a un rol/tester de la app. Para clientes externos se requiere Business Verification y Advanced Access de los cuatro permisos.

Referencias oficiales:

- <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login>
- <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started>
- <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery>
- <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights>
- <https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived>
- <https://developers.facebook.com/docs/graph-api/overview/access-levels>
- <https://developers.facebook.com/docs/graph-api/overview/rate-limiting>
- <https://developers.facebook.com/docs/app-review>
