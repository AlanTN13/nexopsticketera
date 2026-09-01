# Execution Receipt · Radar en la cuenta madre

## Resultado de negocio

- `info@nexopstech.com` conserva su identidad interna `platform_admin`; no se convierte en usuario cliente.
- Radar se incorpora al Backoffice de la cuenta madre con rutas `/backoffice/radar/*`.
- `Sysnexops` no participa de la resolución, autorización ni configuración del Radar interno; sigue siendo una empresa de prueba.
- El workspace interno se descubre desde el manifiesto oficial validado por esquema, o se fija opcionalmente mediante `RADAR_PLATFORM_WORKSPACE_ID`; nunca se obtiene de un `company_id`.
- El acceso falla cerrado: sólo aparece para un `platform_admin` activo y el manifiesto debe declarar un workspace válido.
- La estrategia queda en modo lectura en esta corrección. No se reutilizan preferencias de una empresa cliente ni se introducen escrituras globales sin un modelo de auditoría específico.

## Superficies verificadas

- Menú de Tickets, Empresas, Usuarios y vistas de detalle del Backoffice.
- Acceso directo a centro de control, oportunidades, publicadas e historial.
- Navegación interna sin `?company=`, slug o ID de empresa.
- Rechazo de usuarios no administradores y de entornos sin workspace configurado.

## Pruebas

- TypeScript: PASS.
- ESLint: PASS.
- Vitest: 37 archivos / 159 pruebas PASS.
- Build de producción con webpack: PASS.
- Turbopack no pudo abrir un puerto auxiliar dentro del sandbox; se verificó el mismo build con webpack.

## Gate de producción

- No se aplicaron migraciones ni escrituras en la base productiva.
- No se desplegó ni promovió código a producción.
- Para habilitarlo se requiere un gate explícito posterior para promover la versión validada. `RADAR_PLATFORM_WORKSPACE_ID` es opcional si el manifiesto oficial ya declara el workspace.
