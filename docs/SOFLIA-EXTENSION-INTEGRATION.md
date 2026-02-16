# SOFLIA Extension - Sistema de Notificaciones con Project Hub

## Contexto

La extension SOFLIA ya tiene acceso directo a la base de datos de Project Hub (Supabase). Este documento describe unicamente el sistema de **preferencias de notificaciones** que se agrego para que la extension sepa si el usuario quiere recibir notificaciones y de que tipo.

---

## 1. Tabla: `user_notification_preferences`

Esta tabla almacena las preferencias de notificacion de cada usuario. Se crea con la migracion `014_notification_preferences.sql`.

```sql
CREATE TABLE public.user_notification_preferences (
    preference_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.account_users(user_id) ON DELETE CASCADE,
    email_daily_summary BOOLEAN DEFAULT true,
    soflia_enabled      BOOLEAN DEFAULT false,    -- TOGGLE PRINCIPAL
    soflia_issues       BOOLEAN DEFAULT true,
    soflia_projects     BOOLEAN DEFAULT true,
    soflia_team_updates BOOLEAN DEFAULT true,
    soflia_mentions     BOOLEAN DEFAULT true,
    soflia_reminders    BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_notification_prefs UNIQUE (user_id)
);
```

### Significado de cada campo

| Campo | Default | Que controla |
|---|---|---|
| `soflia_enabled` | `false` | Toggle principal. Si es `false`, la extension NO debe enviar ninguna notificacion al usuario. |
| `soflia_issues` | `true` | Notificar sobre cambios en issues/tareas: asignaciones, cambios de estado, comentarios. |
| `soflia_projects` | `true` | Notificar sobre actualizaciones de proyectos: progreso, hitos, cambios de estado. |
| `soflia_team_updates` | `true` | Notificar sobre cambios en equipos: nuevos miembros, cambios de rol. |
| `soflia_mentions` | `true` | Notificar cuando alguien menciona al usuario en un comentario o tarea. |
| `soflia_reminders` | `true` | Notificar sobre fechas limite proximas y tareas vencidas. |

### Importante

- Si el usuario **NO tiene registro** en esta tabla, significa que nunca configuro sus preferencias. El default es `soflia_enabled = false`, asi que **NO notificar**.
- El usuario activa/desactiva estos toggles desde **Project Hub → Configuracion → Notificaciones**.
- Los sub-toggles (`soflia_issues`, etc.) solo aplican si `soflia_enabled = true`.

---

## 2. Queries que la extension necesita

### 2.1 Verificar si un usuario tiene SOFLIA habilitado

```sql
SELECT soflia_enabled, soflia_issues, soflia_projects,
       soflia_team_updates, soflia_mentions, soflia_reminders
FROM user_notification_preferences
WHERE user_id = '{USER_ID}';
```

Si no hay resultado → `soflia_enabled = false` (no notificar).

### 2.2 Obtener todos los usuarios con SOFLIA habilitado

```sql
SELECT user_id, soflia_issues, soflia_projects,
       soflia_team_updates, soflia_mentions, soflia_reminders
FROM user_notification_preferences
WHERE soflia_enabled = true;
```

Hay un indice parcial optimizado para esta query: `idx_notification_prefs_soflia`.

---

## 3. Tabla existente: `notifications`

Project Hub ya tiene esta tabla donde se guardan las notificaciones. La extension puede leerla directamente para saber que notificar.

```sql
notifications (
    notification_id  UUID PRIMARY KEY
    recipient_id     UUID       -- A quien va dirigida (FK → account_users)
    actor_id         UUID       -- Quien genero la accion (NULL si es sistema)
    title            TEXT       -- Titulo corto: "Te asignaron una nueva tarea"
    message          TEXT       -- Detalle: "Fernando te asigno 'Implementar login'"
    type             VARCHAR(20)  -- 'info', 'success', 'warning', 'error'
    category         VARCHAR(50)  -- 'task', 'project', 'team', 'comment', 'reminder', 'system'
    entity_id        UUID       -- ID del recurso (issue_id, project_id, etc.)
    link             TEXT       -- URL relativa: '/projects/uuid'
    is_read          BOOLEAN    -- Si el usuario ya la leyo
    read_at          TIMESTAMPTZ
    created_at       TIMESTAMPTZ
)
```

### 3.1 Obtener notificaciones no leidas de un usuario

```sql
SELECT *
FROM notifications
WHERE recipient_id = '{USER_ID}'
  AND is_read = false
ORDER BY created_at DESC
LIMIT 20;
```

### 3.2 Marcar una notificacion como leida

```sql
UPDATE notifications
SET is_read = true
WHERE notification_id = '{NOTIFICATION_ID}';
```

El trigger `trg_notification_read_at` se encarga automaticamente de setear `read_at = now()`.

---

## 4. Mapeo: category → preferencia SOFLIA

Cuando la extension obtiene notificaciones, debe filtrarlas segun las preferencias del usuario:

| `notifications.category` | Verificar campo | Ejemplo |
|---|---|---|
| `task` | `soflia_issues` | "Te asignaron la tarea X", "Tarea Y cambio a completada" |
| `project` | `soflia_projects` | "Proyecto Z alcanzo el 80%", "Nuevo hito creado" |
| `team` | `soflia_team_updates` | "Juan se unio al equipo", "Maria cambio de rol" |
| `comment` | `soflia_mentions` | "Fernando te menciono en un comentario" |
| `reminder` | `soflia_reminders` | "La tarea X vence manana", "Tienes 3 tareas pendientes" |
| `system` | Siempre mostrar | "Mantenimiento programado", alertas criticas |

---

## 5. Logica que la extension debe implementar

```
PARA CADA USUARIO:
    1. Consultar user_notification_preferences WHERE user_id = X
    2. Si no existe registro O soflia_enabled = false → SALTAR, no notificar
    3. Si soflia_enabled = true:
        a. Obtener notificaciones no leidas: notifications WHERE recipient_id = X AND is_read = false
        b. Para cada notificacion:
            - Si category = 'task'    Y soflia_issues = false       → NO mostrar
            - Si category = 'project' Y soflia_projects = false     → NO mostrar
            - Si category = 'team'    Y soflia_team_updates = false → NO mostrar
            - Si category = 'comment' Y soflia_mentions = false     → NO mostrar
            - Si category = 'reminder' Y soflia_reminders = false   → NO mostrar
            - Si category = 'system'                                → SIEMPRE mostrar
            - En cualquier otro caso                                → Mostrar
        c. Mostrar las notificaciones filtradas al usuario
        d. Marcar como leidas las que el usuario vio
```

### Query optimizada (todo en una sola consulta)

```sql
SELECT n.*
FROM notifications n
JOIN user_notification_preferences p ON p.user_id = n.recipient_id
WHERE n.recipient_id = '{USER_ID}'
  AND n.is_read = false
  AND p.soflia_enabled = true
  AND (
    (n.category = 'task' AND p.soflia_issues = true) OR
    (n.category = 'project' AND p.soflia_projects = true) OR
    (n.category = 'team' AND p.soflia_team_updates = true) OR
    (n.category = 'comment' AND p.soflia_mentions = true) OR
    (n.category = 'reminder' AND p.soflia_reminders = true) OR
    (n.category = 'system') OR
    (n.category NOT IN ('task', 'project', 'team', 'comment', 'reminder', 'system'))
  )
ORDER BY n.created_at DESC
LIMIT 20;
```

---

## 6. Tablas de referencia utiles

La extension ya tiene acceso a estas tablas para obtener contexto de las notificaciones:

| Tabla | Para que |
|---|---|
| `account_users` | Datos del usuario: nombre, email, avatar, permission_level |
| `pm_projects` | Proyectos: nombre, estado, fecha limite, progreso |
| `task_issues` | Issues/tareas: titulo, estado, prioridad, asignado |
| `teams` | Equipos: nombre, color, miembros |
| `team_members` | Relacion usuario-equipo con rol |
| `workspaces` | Workspaces: nombre, slug |
| `workspace_members` | Relacion usuario-workspace con iris_role |

---

## 7. Resumen

La extension solo necesita:

1. **Leer `user_notification_preferences`** para saber si `soflia_enabled = true`
2. **Leer `notifications`** para obtener notificaciones no leidas
3. **Filtrar** segun los campos `soflia_issues`, `soflia_projects`, etc.
4. **Marcar como leidas** (`UPDATE notifications SET is_read = true`) cuando el usuario las ve

Todo lo demas (generar notificaciones, guardar preferencias, UI de configuracion) ya esta implementado en Project Hub.
