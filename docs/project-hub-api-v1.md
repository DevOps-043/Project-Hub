# Project Hub API v1

Estado: código implementado; migración 024 pendiente de revisión y aplicación autorizada.

La API pública vive bajo `/api/v1`. Todas las respuestas usan `{ data, meta, error? }`, incluyen `correlation_id` y exigen JWT propio de Project Hub salvo el intercambio/refresh. El contrato OpenAPI 3.1 canónico está en `docs/openapi/project-hub-v1.yaml`.

`GET /api/v1/health` es público y no entrega datos de negocio. Comprueba en
tiempo real que el runtime server-side puede comunicarse con la base principal;
responde `503 DATABASE_UNAVAILABLE` cuando la configuración o Supabase fallan.

## Seguridad

- `POST /auth/sofia/exchange` verifica el access token con SOFIA antes de sincronizar la identidad.
- Toda ruta de datos resuelve una membresía activa de workspace y, después, el rol del proyecto.
- owner/admin de workspace administran el workspace; owner/admin de proyecto administran miembros; member escribe tareas/evidencia; viewer/guest leen.
- Las tablas nuevas habilitan RLS con denegación por defecto. La API server-side usa service role después de autorizar; la clave nunca sale del servidor.
- Los endpoints `/api/ext/projects` y `/api/ext/issues` son adaptadores deprecados, requieren alcance de workspace/proyecto y anuncian `Sunset`.

## Persistencia

`apps/database/migrations/024_project_hub_api_v1.sql` agrega identidad SOFIA explícita, evidencia e items, relación tarea-evidencia, actividad, idempotencia, outbox, membresías removibles y el bucket privado `project-files`. Incluye `project_hub_import_meeting`, una función de service role para importar evidencia y tareas en una transacción.

La migración es aditiva. No se ejecuta desde desarrollo: requiere respaldo, revisión SQL y autorización explícita.

## Archivos

El flujo consta de intención, PUT a una URL firmada y finalización. La API limita 10 archivos por operación y 20 MB por archivo, valida extensión/MIME, magic bytes, tamaño y SHA-256. El bucket es privado y las descargas expiran en cinco minutos.

## Configuración del cliente

SofLIA-HUB usa `PROJECT_HUB_API_URL` en Electron main. El rollout funcional se controla fuera del cliente con `PROJECT_HUB_API_V1`, `PROJECT_HUB_UNIFIED_UI`, `MEETING_PROJECT_SYNC_V2` y `BROWSER_COLLECTIONS`.

La entrega de membresías y bindings Lia usa `LIA_PROJECT_HUB_OUTBOX_URL` y el secreto compartido `LIA_PROJECT_HUB_OUTBOX_HMAC_SECRET`. Un scheduler server-side invoca `POST /api/v1/internal/outbox/drain` con `x-outbox-worker-key` igual a `PROJECT_HUB_OUTBOX_WORKER_KEY`. El consumidor Lia verifica HMAC y una ventana máxima de cinco minutos; estas variables nunca se exponen al renderer.
