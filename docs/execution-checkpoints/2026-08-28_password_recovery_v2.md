# EXECUTION CHECKPOINT — Recuperación de contraseña V2

Fecha: 2026-08-28

## Proyecto / resultado

Ticketera NexOps — recuperación autoservicio de contraseña sobre Supabase Auth SSR.

## Estado

`READY_FOR_REVIEW / BLOCKED_EXTERNAL para publicación`

La implementación local está completa y validada. No se modificaron producción, datos, migraciones, RLS, credenciales ni dependencias.

## Repo / branch / PR

- Repo: `AlanTN13/nexopsticketera`
- Base local verificada: `main` en `cd27cef723fb58403cb95ed2fb810a5cb7cb6314`
- Branch: `codex/ticketera-password-recovery-v2`
- PR: pendiente; la autenticación local de GitHub para `AlanTN13` está vencida.
- Artefactos del intento 01: las ramas y el commit abortados documentados no existen en este clone y no fueron reutilizados.

## Alcance implementado

- solicitud pública con validación de email y respuesta que no enumera cuentas;
- URL de callback construida únicamente desde el origen público configurado;
- intercambio de código PKCE en el callback SSR;
- allowlist estricta del destino de recuperación para evitar redirecciones abiertas;
- pantalla autenticada para elegir y confirmar una contraseña nueva;
- reutilización de la política de contraseña existente;
- acceso desde el formulario de login;
- documentación del flujo y de su validación de piloto.

## Última evidencia

- `npm run lint`: verde;
- `npm run typecheck`: verde;
- `npm test`: 17 archivos / 70 tests verdes;
- `npm run build`: verde; rutas nuevas incluidas en el build;
- `git diff --check`: verde;
- smoke visual local: HTTP 200, contenido y controles presentes, sin overlay ni errores de consola.

`npm audit` no pudo consultar el registro porque la red del sandbox está cerrada. No cambiaron `package.json` ni `package-lock.json`; las dos vulnerabilidades moderadas ya documentadas en `main` no fueron modificadas por esta entrega.

## Bloqueos

### BLOCKED_EXTERNAL — publicación GitHub

- Causa: el token de `gh` para `AlanTN13` es inválido.
- Acción mínima: reautenticar GitHub en esta máquina.
- Después: publicar la branch, abrir la PR y adjuntar este checkpoint sin pedir una decisión técnica adicional.

### Gate externo — validación E2E no productiva

Para declarar el flujo operativo se debe probar en el entorno no productivo autorizado:

- entrega real del email de recuperación;
- redirect URL permitida en Supabase;
- intercambio PKCE en el mismo navegador/dispositivo;
- cambio efectivo de contraseña;
- expiración y no reutilización del enlace;
- política de contraseña y Leaked Password Protection según el gate vigente.

## Siguiente movimiento

1. Reautenticar GitHub.
2. Push de `codex/ticketera-password-recovery-v2` y apertura de PR.
3. Ejecutar el recorrido E2E en el entorno no productivo con datos sintéticos.
4. Corregir cualquier hallazgo, actualizar evidencia y llevar a review/merge.
