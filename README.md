# Portal NexOps

Portal multiempresa en Next.js 16 con Supabase como único backend de ejecución. La Ticketera continúa como el módulo **Soporte** y la reportería de marketing de NexOps vive en **Métricas**, bajo una sola sesión.

Rutas de cliente:

- `/portal`: Inicio.
- `/portal/soporte`: tickets y seguimiento.
- `/portal/metricas`: reportería habilitada por empresa.
- `/portal/radar`: planificación de contenidos habilitada por empresa.
- `/portal/contenido`: conexión oficial, fuentes observadas e historial de Instagram habilitado por workspace.
- `/portal/tickets/[ticketCode]`: enlaces históricos y detalle de ticket compatibles.

## Arquitectura V1

- Supabase Auth con sesión SSR en cookies gestionadas por `@supabase/ssr`.
- Postgres y Data API bajo la identidad JWT del usuario autenticado.
- RLS como barrera principal de aislamiento entre empresas.
- Storage privado para adjuntos, también protegido por RLS.
- `service_role` limitado a Auth Admin y al adaptador server-only de Contenido que cifra credenciales y escribe snapshots.
- Productos opcionales habilitados por empresa desde Backoffice y protegidos por RLS.
- Sin JSON local, contraseña demo, seed automático ni fallback silencioso.

Más detalle: `docs/AUTHORIZATION.md`.

## Configuración

Requisitos: Node.js 20/22/24+, npm y un proyecto Supabase no productivo para desarrollo.

```bash
npm ci
cp .env.example .env.local
```

Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=https://portal.nexopstech.com
PORTAL_METRICS_META_SHEET_URL=
PORTAL_METRICS_MAILCHIMP_SHEET_URL=
PORTAL_METRICS_COMPANY_CONFIG=
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v24.0
META_TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
```

La clave publicable puede estar en el frontend y queda limitada por grants y RLS. `SUPABASE_SERVICE_ROLE_KEY` es server-only y solo es necesaria para crear o editar usuarios desde acciones administrativas. Nunca debe llevar prefijo `NEXT_PUBLIC_`.

La variable legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` sigue aceptada durante la migración, pero los proyectos nuevos deben usar la clave publicable.

`RESEND_API_KEY` es server-only y no debe llevar el prefijo `NEXT_PUBLIC_`. `NEXT_PUBLIC_APP_URL` define el origen de los enlaces “Ver ticket”; el objetivo del Portal es `https://portal.nexopstech.com`. El servicio también acepta `VERCEL_PROJECT_PRODUCTION_URL` o `VERCEL_URL` como fallback para entornos temporales y nunca construye enlaces a partir de headers del navegador.

Las variables `PORTAL_METRICS_*_SHEET_URL` son server-only. El navegador no recibe las URLs de Google Sheets: el servidor descarga el CSV desde una lista de hosts permitidos y filtra la cuenta usando la empresa de la sesión. La disponibilidad de Métricas y Radar se administra por empresa desde Backoffice; `PORTAL_METRICS_COMPANY_CONFIG` queda limitado a sobreescribir identificadores o presentación de reportería durante la transición. Ver `docs/PORTAL_MODULES.md`.

## Notificaciones por email

El envío se realiza después de guardar la operación principal y usa claves idempotentes de Resend. Un error del proveedor se registra sin destinatarios, contenido ni credenciales y no se muestra al usuario. Remitente: `NexOps Soporte <soporte@nexopstech.com>`; Reply-To: `info@nexopstech.com`.

Prueba manual de los cuatro eventos en un entorno no productivo con las variables configuradas:

1. Iniciar sesión como cliente y crear un ticket: debe llegar un único email a `info@nexopstech.com`.
2. Agregar otro mensaje externo como cliente: debe llegar un aviso interno. La descripción inicial no cuenta como este evento.
3. Responder externamente desde Backoffice: debe llegar un email al creador del ticket. Una nota interna no debe enviar nada.
4. Cambiar el estado desde Backoffice: debe avisar al creador solo cuando el valor realmente cambia; guardar el mismo estado no debe enviar nada.

Verificar en todos los casos asunto, contenido, botón “Ver ticket” y destino del enlace. La suite automatizada valida el ruteo y las exclusiones, pero no sustituye una prueba real de entrega con Resend.

## Base de datos local o staging

Las migraciones viven en `supabase/migrations/`. Para una base vacía se aplican en orden; la migración `harden_ticketing_v1` reemplaza las políticas antiguas, agrega grants explícitos, helpers privados con `search_path` fijo, constraints, índices y generación atómica de códigos.

No ejecutes comandos de link/push/reset contra producción. En un proyecto local o staging identificado:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

Luego seguí `SUPABASE_MVP_CHECKLIST.md`. Este repositorio no incluye seed automático. Las cuentas y empresas de staging se crean deliberadamente para las pruebas y se eliminan según la política del entorno.

## Desarrollo

```bash
npm run dev
```

- Login: `http://localhost:3000/portal/login`
- Portal: `http://localhost:3000/portal`
- Soporte: `http://localhost:3000/portal/soporte`
- Métricas: `http://localhost:3000/portal/metricas`
- Radar: `http://localhost:3000/portal/radar`
- Contenido: `http://localhost:3000/portal/contenido`
- Backoffice: `http://localhost:3000/backoffice`
- Diagnóstico: `http://localhost:3000/setup`

Si Supabase no está configurado, la aplicación falla explícitamente. No existe modo demo.

## Validaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
npm audit
```

Las pruebas locales cubren roles, rutas protegidas a nivel de autorización, aislamiento A/B, IDs directos, comentarios, workflow y métricas. Las políticas reales deben validarse adicionalmente sobre Supabase local o staging.

## Piloto y preparación productiva

El proyecto `tfonsiurhjmllqaknhgh` es la única base de desarrollo, piloto interno y producción futura. La limpieza de datos temporales no es automática y requiere autorización explícita. Consultar:

- `docs/INTERNAL_PILOT.md` para operar el piloto controlado;
- `docs/PREPRODUCTION_CLEANUP.md` para inventario, backup, clasificación, limpieza y smoke test preproducción.

## Invitaciones y recuperación de acceso

Las altas administrativas generan una invitación de un solo uso y dejan el perfil en estado `invited`. La persona define su propia contraseña (mínimo 12 caracteres) y el perfil pasa a `active` mediante una RPC acotada. NexOps no conoce ni transmite contraseñas iniciales.

La recuperación de contraseña usa el flujo PKCE de Supabase Auth:

1. `/portal/recuperar-acceso` solicita el email y siempre responde sin revelar si la cuenta existe.
2. Supabase envía el enlace con destino al callback público configurado mediante `NEXT_PUBLIC_APP_URL`.
3. `/auth/callback` intercambia el código una sola vez y sólo admite `/portal/restablecer-acceso` como destino.
4. La pantalla de restablecimiento exige una sesión Auth válida y actualiza únicamente la contraseña del usuario autenticado.

Antes de considerarlo operativo se debe validar el recorrido completo en un entorno no productivo, incluida la entrega real del email, la URL permitida en Supabase y la expiración/reutilización del enlace.

## Fuente de verdad

- Local: `/Users/alanfernandez/Desktop/nexops-tiketera`
- GitHub: `https://github.com/AlanTN13/nexopsticketera`
- Rama canónica: `main`
