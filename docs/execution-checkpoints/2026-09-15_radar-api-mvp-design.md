> HISTORICAL / SUPERSEDED: the direct backend worker described here was removed by the n8n reconciliation. See `2026-09-17_radar-n8n-reconciliation.md`. Do not activate the old runtime.

# Radar API MVP — Delivery Design

## Resultado / snapshot
Buscar ahora → máximo una nota o NO_PUBLICATION → QA separado PASS/FIX/REJECT → PNG 1600×900 → preview web → aprobación humana. Main Portal 8b6e7d5; web 760e328. Se preservan manual_note y el historial. PR de publicación #73 no se reintenta. No activar cron ni autopublicación.

## Clasificación y arquitectura
T3 / L / R3 (contrato, credenciales y persistencia). A0 reutiliza Portal Next, Supabase y publicador Git existente; A1 extiende motor y paquete. No nuevos servicios/colas. Ejecución acotada dentro del backend existente, independiente de la pestaña; plazo máximo y estado terminal recuperable. Gate server-only y reserva atómica de uso antes de llamar API. Configuración y corpus capturados por corrida; fuentes completas y evidencia para el crítico. Dos llamadas normales, cuatro como máximo tras FIX. No consumo real mientras falten inyección segura y límite habilitado del piloto.

## Equipo / capacidad
Dirección conserva motor, integración, persistencia y gates. Especialista de paquete/sitio cubre portada PNG, aprobación de paquete exacto y preview. Revisión independiente del cambio de persistencia/consumo antes del cierre. Superficies de escritura separadas. Reconocimiento focalizado concluido; implementación y QA tienen prioridad sobre más planificación. Checks focalizados durante desarrollo; suites globales una vez integrado.

## Challenge previo
Una petición ilimitada no sirve; se exige plazo menor al límite real del deployment. No cola privada alternativa ni fallback a Work. Reutilizar estado no permite carreras: reservas/actualizaciones deben condicionar estado y prevenir respuestas tardías. Preview no publica. Digest debe incluir fuentes y portada final. El contador de uso no puede depender de memoria de proceso. Migración aditiva, jamás borra #4/#5. Secretos sólo server-only, respuesta de proveedor saneada, herramientas web sin ejecutar instrucciones de las fuentes.

## QA / rollout
Cubrir bueno, NO_PUBLICATION, REJECT/fuente insuficiente, FIX→revisión, duplicado/doble clic, timeout, cancelación tardía, presupuesto, PNG real, permisos, aprobación exacta y fallo de publicación conservando borrador. Portal tests/lint/typecheck/build; sitio news:test, tests/lint/build; preview integrada. Datos simulados etiquetados. Piloto real condicionado a credencial y límite. Rollback: deshabilitar motor; conservar estados/paquetes; no activar puente viejo automáticamente. #4/#5 sólo se reconcilian luego de corte validado.
