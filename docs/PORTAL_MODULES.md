# Productos habilitados por empresa

Portal NexOps mantiene una sola sesión, una sola empresa activa y un único shell visual. Soporte es el módulo base. Métricas y Radar son productos opcionales que NexOps habilita manualmente desde el Backoffice de cada empresa.

## Contrato de aplicación

```ts
type CompanyModules = {
  metrics: {
    enabled: boolean;
    settings: {
      accountName?: string;
      mailchimpName?: string;
      objective?: "CONVERSACIONES" | "LEADS" | "COMPRAS";
    };
  };
  radar: {
    enabled: boolean;
    settings: {
      workspaceId?: string;
    };
  };
};
```

`enabled` controla navegación y acceso directo a la ruta. `settings` asocia la configuración propia de la empresa y se conserva cuando se prende o apaga un producto.

## Persistencia y autorización

- `public.company_modules` guarda una fila por empresa y producto.
- Los clientes sólo pueden leer las filas de su empresa.
- Los usuarios internos pueden leer todas las habilitaciones.
- Sólo `team_lead` y `platform_admin` pueden modificarlas.
- `update_company_module_configuration` cambia disponibilidad y workspace en una sola operación autorizada.
- Global Trip conserva Métricas habilitado durante la migración. Métricas queda apagado para las demás empresas y Radar queda apagado para todas.

## Integración de Radar

Radar vive en `/portal/radar`, dentro del mismo AppShell y la misma sesión de Supabase. La integración exige simultáneamente:

1. `company.modules.radar.enabled === true`;
2. un `company.modules.radar.settings.workspaceId` válido;
3. que el servidor soporte explícitamente ese workspace.

El Backoffice obliga a asignar un workspace antes de habilitar Radar. La consulta se
realiza desde una capa server-only que devuelve únicamente campos de negocio
validados. Las publicaciones provienen de un manifiesto público reducido; las
decisiones descartadas se leen desde un repositorio privado con una credencial de
solo lectura.

Si falta `workspaceId` o no está soportado, el Portal muestra un estado de
configuración y no consulta ni serializa datos. No se admiten iframe, autenticación
paralela ni enlaces a una aplicación pública como sustituto de esta verificación.

## Dominio

El origen canónico es `https://portal.nexopstech.com`. `https://soporte.nexopstech.com` se conserva como dominio legado y redirige con código 308 manteniendo ruta y parámetros cuando `PORTAL_CANONICAL_REDIRECT_ENABLED=true`. La bandera debe permanecer apagada hasta confirmar DNS, SSL y la URL de redirección en Supabase Auth.
