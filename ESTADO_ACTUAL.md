# Estado V1 técnico

## Entorno Supabase definitivo

El proyecto `tfonsiurhjmllqaknhgh` se utiliza para desarrollo y piloto interno y será la base productiva definitiva. No se debe crear otro proyecto. Durante el piloto solo se permiten datos controlados e identificables; su limpieza futura exige backup completo y autorización separada según `docs/PREPRODUCTION_CLEANUP.md`.

## Implementado en esta rama

- Supabase es el único backend.
- Sesiones oficiales SSR reemplazan la cookie HMAC propia.
- Lecturas y mutaciones normales usan la identidad del usuario y respetan RLS.
- `service_role` queda restringido a dos operaciones `auth.admin`: crear y actualizar cuentas.
- Se retiraron store JSON, seed automático, contraseña demo, reset y fallback.
- La migración V1 normaliza grants, RLS, funciones privadas, Storage, constraints e índices.
- Los códigos de ticket se generan mediante secuencia Postgres, evitando carreras de aplicación.
- Existe una suite mínima de seguridad y métricas.

## Validación de staging

Las cinco migraciones fueron aplicadas en `tfonsiurhjmllqaknhgh`. Pasaron las pruebas reales A/B con JWT, acceso directo por ID, comentarios internos, Storage, Auth SSR y el recorrido funcional de portal/backoffice. Security Advisor conserva únicamente el warning de Leaked Password Protection deshabilitada, que debe resolverse antes del uso oficial.

## Invitaciones

El alta sigue siendo directa por un administrador con contraseña inicial. Aceptación por email, expiración y recuperación de contraseña quedan pendientes.

## Vulnerabilidades npm

- `js-yaml` quedó actualizado mediante override compatible a `5.2.1`.
- Next se actualizó de `16.2.6` a `16.2.10`.
- `npm audit` conserva dos entradas moderadas que representan una sola cadena: PostCSS `<8.5.10` embebido por Next y Next como dependencia afectada. El proyecto no acepta CSS de usuarios ni ejecuta un stringify de CSS no confiable; el uso observado es build-time, por lo que no se identificó una ruta explotable en la aplicación.
- npm propone bajar a Next `9.3.3`; se rechazó por destructivo. También se probó un override de PostCSS y se descartó porque dejó el árbol npm inválido. Debe actualizarse cuando Next publique una dependencia corregida compatible.
