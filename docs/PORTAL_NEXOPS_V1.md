# Portal NexOps V1 — Soporte + Métricas

## Resultado

La aplicación deja de presentarse como Ticketera independiente. El cliente usa una sola sesión de Supabase y navega:

- Inicio: `/portal`;
- Soporte: `/portal/soporte`;
- Métricas: `/portal/metricas`;
- detalle histórico de tickets: `/portal/tickets/[ticketCode]`.

El backoffice mantiene sus rutas y comportamiento actuales.

## Qué se reutilizó de la reportería de Joaquín

- tipos y normalización de CSV;
- cálculos de KPIs de Meta Ads;
- agregación diaria, por campaña y por creativo;
- filtros, selector de indicadores, gráficos y tablas;
- parser y dashboard de Emailing/Mailchimp;
- identidad visual por cliente.

No se portaron el login simulado, usuarios/contraseñas en Sheets, selector global de clientes, Settings, URLs editables ni persistencia en `localStorage`. Esas piezas pertenecían al prototipo independiente y contradicen Auth, RLS y aislamiento del Portal.

## Adaptación de seguridad

1. El usuario se autentica sólo con Supabase Auth.
2. El servidor obtiene el perfil activo y su `companyId`.
3. La empresa define qué perfil de Métricas corresponde.
4. Las URLs de Sheets se leen desde variables server-only.
5. Sólo se aceptan URLs HTTPS publicadas desde `docs.google.com`.
6. El CSV completo se descarga en el servidor.
7. Las filas se filtran por cuenta antes de serializarlas al navegador.
8. No existe parámetro de URL que permita elegir empresa, cuenta o Sheet.

## Configuración de módulos

`src/lib/portal-modules.ts` contiene una configuración mínima para los clientes que aparecen en el prototipo entregado. Una empresa sin perfil no ve el módulo Métricas.

Se puede sobreescribir por entorno:

```env
PORTAL_METRICS_COMPANY_CONFIG={"globaltrip":{"enabled":true,"accountName":"GLOBAL TRIP","objective":"CONVERSACIONES"}}
```

Un perfil con `enabled: false` oculta el módulo. Esta V1 no implementa planes, facturación ni un panel comercial.

## Fuentes de reportería

```env
PORTAL_METRICS_META_SHEET_URL=
PORTAL_METRICS_MAILCHIMP_SHEET_URL=
```

Las hojas deben estar publicadas como CSV. La app no acepta una URL enviada por el navegador y no expone los IDs técnicos en HTML o JavaScript.

El ZIP recibido no contiene la URL real de Meta Ads ni una URL de Mailchimp: el prototipo las guardaba en `localStorage`. Hasta que esas variables existan en Preview, Métricas muestra un estado explícito de fuente pendiente y nunca presenta datos mock como si fueran reales.

## Continuidad para Joaquín

Superficies principales:

- `src/components/metrics/client-dashboard.tsx`: experiencia Meta Ads portada;
- `src/components/metrics/client-emailing-dashboard.tsx`: experiencia Emailing portada;
- `src/features/metrics/csv-parser.ts`: parsers y agregaciones;
- `src/components/metrics/metrics-workspace.tsx`: navegación entre canales y período;
- `src/lib/metrics-data.ts`: carga y aislamiento server-side;
- `src/lib/portal-modules.ts`: habilitación por empresa.

Para sumar Kommo, agregar un canal dentro de `MetricsWorkspace` y su loader server-side. No crear login, selector de empresa ni endpoint de proxy abierto.

## Dominio y compatibilidad

Objetivo: `portal.nexopstech.com`.

Antes del cambio de origen canónico:

1. agregar `https://portal.nexopstech.com/**` a Redirect URLs de Supabase Auth;
2. definir `NEXT_PUBLIC_APP_URL=https://portal.nexopstech.com` en Vercel;
3. verificar invitación y recuperación PKCE sobre el nuevo host;
4. conservar `soporte.nexopstech.com` durante la transición;
5. redirigir el origen anterior a `/portal/soporte` sólo después del smoke.

Las URLs `/portal/tickets/[ticketCode]` permanecen válidas para enlaces de emails anteriores.
