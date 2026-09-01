# EXECUTION RECEIPT — Canal Kommo en Métricas

Fecha: 2026-09-01

## Resultado

Entrega acotada para incorporar un tercer canal de reportería CRM en `/portal/metricas`, visible únicamente cuando la empresa tiene una URL de reporte válida configurada.

## Estado

`READY_TO_MERGE`

## Trazabilidad

- Issue: `AlanTN13/nexopsticketera#60`
- PR: `AlanTN13/nexopsticketera#61`
- Branch: `codex/kommo-metrics-dexa-20260902`
- Base verificada: `main` en `85029da`

## Alcance entregado

- selector condicional de Kommo dentro del módulo Métricas;
- reporte de Looker Studio responsive, con pantalla vacía clara cuando no hay configuración;
- período controlado por el reporte externo, sin reutilizar el filtro compartido de Meta Ads y Emailing;
- texto de actualización limitado a Meta Ads y Emailing;
- configuración por empresa en `company_modules.settings.kommoEmbedUrl`;
- edición restringida a `platform_admin` mediante el backoffice existente;
- allowlist exacta de hosts y formato de URL de reporte embebido;
- CSP acotada a los dos hosts autorizados e iframe con sandbox y fullscreen;
- migraciones compatibles con clientes anteriores y preservación de settings ajenos;
- permiso de lectura de Métricas otorgado únicamente al usuario cliente autorizado de la empresa de presentación.

## Privacidad

El Portal no se considera la barrera de privacidad del reporte. El recurso de Looker Studio exige una sesión de Google autorizada y no es visible de forma anónima. No se modificaron permisos ni políticas de uso compartido del reporte.

La URL real del reporte permanece únicamente en la configuración privada de la empresa; no se incorporó al repositorio, a la issue ni a la PR.

## Evidencia

- suite completa: 42 archivos / 186 tests verdes;
- lint, typecheck y build de CI verdes;
- build local alternativo con Webpack verde (el runner local impidió a Turbopack abrir un puerto interno);
- GitHub Actions y previews de Vercel verdes para ambos proyectos vinculados;
- validación de base: una sola empresa configurada, cero empresas ajenas con URL de Kommo y URL arbitraria rechazada;
- prueba no-op: actualizar la configuración de Kommo no escribe ni audita settings ajenos;
- revisión React sin hallazgos;
- preview navegable hasta su login protegido;
- smoke autenticado de cliente y capturas responsive a completar inmediatamente después del despliegue, usando la sesión vigente del dominio productivo sin trasladar credenciales al preview.

## Criterio de cierre

La PR puede integrarse porque implementación, seguridad, datos, CI y previews están en verde. El cierre operativo requiere confirmar en producción el canal Kommo en escritorio y móvil, sin overflow horizontal, con el iframe y el mensaje de período esperados.
