# Schema snapshots

Estos archivos **no son migraciones**. Son dumps de esquema (`pg_dump`-style) para dar
contexto a herramientas de IA o a alguien explorando el modelo de datos. Cada uno empieza con:

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
```

No ejecutar contra ninguna base de datos. Si necesitas aplicar un cambio de esquema, agrega
una migración numerada nueva en `apps/database/migrations/`.

| Archivo               | Instancia real                                           |
| ---------------------- | --------------------------------------------------------- |
| `DataBase.sql`         | **Project Hub.** Contiene `account_users`, `pm_projects`, `task_cycles`, etc. Es el más completo de los dos dumps de Project Hub: además del esquema base, tiene una sección final con `task_cycles` en su forma **corregida** (`cycle_number`, `cooldown_days`, `scope_count`, `completed_count`, `progress_percent`, `completed_at`) y los índices de rendimiento — evidencia de que refleja el estado *después* de esa migración. |
| `project-hub.sql`      | **Project Hub**, dump más viejo — mismo esquema base que la primera mitad de `DataBase.sql`, pero **sin** la sección corregida de `task_cycles` (se quedó en el `task_cycles` original de `005_task_management.sql`). |
| `soflia-learning.sql`  | **SOFIA** (auth + plataforma de aprendizaje: `users`, `courses`, `course_lessons`, `certificate_ledger`, `lia_conversations`, etc.) |
| `BD.sql`                | **También SOFIA** — otro snapshot de la misma instancia que `soflia-learning.sql` (mismas tablas: `users`, `courses`, `lia_conversations`...), **no es Project Hub**. Se investigó por error como si fuera Project Hub; queda corregido acá. |

**Resolución de `task_cycles` (005 vs 020):** el `task_cycles` corregido en la sección final
de `DataBase.sql` (`cycle_number`, `cooldown_days`, `status` con `'active'`/`'cancelled'`)
coincide con lo que `app/api/admin/teams/[teamId]/cycles/*.ts` y
`app/api/workspaces/[slug]/analytics/route.ts` realmente leen/escriben — esa es la evidencia,
**no** `BD.sql` (que es de otra base de datos). `apps/database/migrations/021_reconcile_task_cycles_schema.sql`
lleva cualquier base con el `task_cycles` viejo de `005_task_management.sql` al esquema real.

**`teams`/`team_members` no tenían migración propia:** `DataBase.sql` (líneas 486-519) prueba
que ambas tablas existen en producción con columnas, constraints e índices propios, pero
ninguna migración numerada las creaba — `003_project_management.sql` ya las referencia
(`pm_projects.team_id REFERENCES teams`) sin haberlas creado antes, así que bootstrapear una
base nueva corriendo `001..021` en orden fallaba en `003`. `apps/database/migrations/022_add_teams_and_team_members.sql`
las agrega (`IF NOT EXISTS`, segura de correr aunque tu base ya las tenga); ver el comentario
de esa migración para el orden correcto en un bootstrap desde cero.
