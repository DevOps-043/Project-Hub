-- ============================================================================
-- IRIS Task Management System - Similar to Linear
-- Migration: 005_task_management.sql
-- Created: 2025-12-25
-- ============================================================================

-- ============================================================================
-- 1. TASK STATUSES (Estados de tareas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_statuses (
    status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    
    -- Status info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6B7280', -- Hex color
    icon VARCHAR(50), -- Icon identifier (e.g., 'circle', 'progress', 'done', 'cancelled')
    
    -- Status type for system logic
    status_type VARCHAR(30) NOT NULL CHECK (status_type IN (
        'backlog',      -- Pendiente / Sin empezar
        'todo',         -- Por hacer
        'in_progress',  -- En progreso
        'in_review',    -- En revisión
        'done',         -- Completado
        'cancelled'     -- Cancelado
    )),
    
    -- Ordering
    position INTEGER NOT NULL DEFAULT 0,
    
    -- Settings
    is_default BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE, -- Tasks in this status are considered closed
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_statuses_team ON task_statuses(team_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_position ON task_statuses(team_id, position);

-- ============================================================================
-- 2. TASK PRIORITIES (Prioridades)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_priorities (
    priority_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Priority info
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL UNIQUE, -- 0=no priority, 1=urgent, 2=high, 3=medium, 4=low
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Insert default priorities
INSERT INTO task_priorities (name, level, color, icon) VALUES
    ('No Priority', 0, '#6B7280', 'minus'),
    ('Urgent', 1, '#EF4444', 'alert-circle'),
    ('High', 2, '#F97316', 'chevron-up'),
    ('Medium', 3, '#EAB308', 'equal'),
    ('Low', 4, '#22C55E', 'chevron-down')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. TASK LABELS (Etiquetas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_labels (
    label_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    
    -- Label info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL DEFAULT '#6366F1',
    
    -- Metadata
    created_by UUID REFERENCES account_users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_task_labels_team ON task_labels(team_id);

-- ============================================================================
-- 4. CYCLES / SPRINTS (Ciclos de trabajo)
-- ============================================================================
-- NOTA: este esquema de task_cycles quedó desactualizado (ver migración 021,
-- que reconcilia contra el esquema real vigente en producción: cycle_number,
-- cooldown_days, scope_count/completed_count/progress_percent, completed_at,
-- status con 'active'/'cancelled'). Se deja tal cual por ser historial ya
-- aplicado; no editar esta definición, corregir hacia adelante en 021+.
CREATE TABLE IF NOT EXISTS task_cycles (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    
    -- Cycle info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    number INTEGER, -- Cycle number within team (auto-incremented)
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN (
        'upcoming',     -- Futuro
        'current',      -- Activo
        'completed'     -- Terminado
    )),
    
    -- Progress tracking
    scope_total INTEGER DEFAULT 0,       -- Total de tareas al inicio
    scope_completed INTEGER DEFAULT 0,   -- Tareas completadas
    
    -- Metadata
    created_by UUID REFERENCES account_users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_task_cycles_team ON task_cycles(team_id);
CREATE INDEX IF NOT EXISTS idx_task_cycles_dates ON task_cycles(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_task_cycles_status ON task_cycles(team_id, status);

-- ============================================================================
-- 5. TASK ISSUES (Tareas principales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issues (
    issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifier (like ECOS-407, PULSE-123)
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    issue_number INTEGER NOT NULL, -- Auto-incremented per team
    
    -- Core info
    title VARCHAR(500) NOT NULL,
    description TEXT,
    description_html TEXT, -- Rich text version
    
    -- Status & Priority
    status_id UUID NOT NULL REFERENCES task_statuses(status_id) ON DELETE RESTRICT,
    priority_id UUID REFERENCES task_priorities(priority_id) ON DELETE SET NULL,
    
    -- Relationships (usando pm_projects si existe)
    project_id UUID, -- No FK para flexibilidad - puede referenciar pm_projects
    cycle_id UUID REFERENCES task_cycles(cycle_id) ON DELETE SET NULL,
    parent_issue_id UUID REFERENCES task_issues(issue_id) ON DELETE SET NULL, -- Sub-tasks
    
    -- Assignment
    assignee_id UUID REFERENCES account_users(user_id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES account_users(user_id) ON DELETE RESTRICT,
    
    -- Dates
    due_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Estimates
    estimate_points INTEGER, -- Story points (0.5, 1, 2, 3, 5, 8, 13...)
    estimate_hours DECIMAL(6,2), -- Time estimate in hours
    time_spent_minutes INTEGER DEFAULT 0,
    
    -- Sorting & Display
    sort_order DECIMAL(20,10) DEFAULT 0, -- For manual ordering
    
    -- Additional data
    url_slug VARCHAR(200), -- SEO-friendly URL
    external_links JSONB DEFAULT '[]', -- Links to external resources
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    
    UNIQUE(team_id, issue_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_issues_team ON task_issues(team_id);
CREATE INDEX IF NOT EXISTS idx_task_issues_status ON task_issues(status_id);
CREATE INDEX IF NOT EXISTS idx_task_issues_assignee ON task_issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_issues_project ON task_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_task_issues_cycle ON task_issues(cycle_id);
CREATE INDEX IF NOT EXISTS idx_task_issues_parent ON task_issues(parent_issue_id);
CREATE INDEX IF NOT EXISTS idx_task_issues_due_date ON task_issues(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_issues_created ON task_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_issues_sort ON task_issues(team_id, status_id, sort_order);

-- Full text search
CREATE INDEX IF NOT EXISTS idx_task_issues_search ON task_issues USING gin(
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- ============================================================================
-- 6. ISSUE LABELS JUNCTION (Relación Issue-Label)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issue_labels (
    issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES task_labels(label_id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (issue_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_task_issue_labels_label ON task_issue_labels(label_id);

-- ============================================================================
-- 7. ISSUE SUBSCRIBERS (Suscriptores/Watchers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issue_subscribers (
    issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES account_users(user_id) ON DELETE CASCADE,
    
    subscription_type VARCHAR(20) DEFAULT 'all' CHECK (subscription_type IN (
        'all',          -- Todas las notificaciones
        'mentions',     -- Solo menciones
        'status_change' -- Solo cambios de estado
    )),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (issue_id, user_id)
);

-- ============================================================================
-- 8. ISSUE COMMENTS (Comentarios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issue_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    
    -- Parent comment for threads
    parent_comment_id UUID REFERENCES task_issue_comments(comment_id) ON DELETE CASCADE,
    
    -- Content
    body TEXT NOT NULL,
    body_html TEXT, -- Rich text version
    
    -- Author
    author_id UUID NOT NULL REFERENCES account_users(user_id) ON DELETE RESTRICT,
    
    -- Reactions (stored as JSON for flexibility)
    reactions JSONB DEFAULT '{}', -- {"👍": ["user_id1", "user_id2"], "❤️": ["user_id3"]}
    
    -- Edit tracking
    edited_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_comments_issue ON task_issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author ON task_issue_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON task_issue_comments(parent_comment_id);

-- ============================================================================
-- 9. ISSUE ATTACHMENTS (Archivos adjuntos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issue_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    comment_id UUID REFERENCES task_issue_comments(comment_id) ON DELETE CASCADE,
    
    -- File info
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER, -- in bytes
    storage_url TEXT NOT NULL, -- URL in Supabase Storage
    thumbnail_url TEXT, -- For images
    
    -- Uploader
    uploaded_by UUID NOT NULL REFERENCES account_users(user_id) ON DELETE RESTRICT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_issue ON task_issue_attachments(issue_id);

-- ============================================================================
-- 10. ISSUE HISTORY (Historial de cambios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issue_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    
    -- Who made the change
    actor_id UUID NOT NULL REFERENCES account_users(user_id) ON DELETE RESTRICT,
    
    -- What changed
    field_name VARCHAR(100) NOT NULL, -- 'status', 'assignee', 'priority', etc.
    old_value TEXT,
    new_value TEXT,
    old_value_id UUID, -- For references (e.g., old status_id)
    new_value_id UUID,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_history_issue ON task_issue_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created ON task_issue_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_history_actor ON task_issue_history(actor_id);

-- ============================================================================
-- 11. ISSUE RELATIONS (Relaciones entre tareas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_issue_relations (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Related issues
    source_issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    target_issue_id UUID NOT NULL REFERENCES task_issues(issue_id) ON DELETE CASCADE,
    
    -- Relation type
    relation_type VARCHAR(30) NOT NULL CHECK (relation_type IN (
        'blocks',       -- Source blocks target
        'is_blocked_by',-- Source is blocked by target
        'relates_to',   -- Generic relation
        'duplicates',   -- Source is duplicate of target
        'is_duplicated_by'
    )),
    
    -- Metadata
    created_by UUID REFERENCES account_users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (source_issue_id != target_issue_id),
    UNIQUE(source_issue_id, target_issue_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_task_relations_source ON task_issue_relations(source_issue_id);
CREATE INDEX IF NOT EXISTS idx_task_relations_target ON task_issue_relations(target_issue_id);

-- ============================================================================
-- 12. SAVED VIEWS / FILTERS (Vistas guardadas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_saved_views (
    view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    
    -- View info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    
    -- Filter configuration (stored as JSON)
    filters JSONB NOT NULL DEFAULT '{}',
    -- Example: {"status": ["uuid1", "uuid2"], "assignee": "uuid", "priority": [1,2]}
    
    -- Display configuration
    display_config JSONB DEFAULT '{}',
    -- Example: {"groupBy": "status", "sortBy": "created_at", "columns": ["title", "status"]}
    
    -- Visibility
    is_shared BOOLEAN DEFAULT FALSE, -- Shared with team
    created_by UUID REFERENCES account_users(user_id) ON DELETE SET NULL,
    
    -- Ordering
    position INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_views_team ON task_saved_views(team_id);
CREATE INDEX IF NOT EXISTS idx_task_views_creator ON task_saved_views(created_by);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to auto-increment issue number per team
CREATE OR REPLACE FUNCTION generate_issue_number()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(issue_number), 0) + 1
    INTO NEW.issue_number
    FROM task_issues
    WHERE team_id = NEW.team_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_issue_number ON task_issues;
CREATE TRIGGER trg_issue_number
    BEFORE INSERT ON task_issues
    FOR EACH ROW
    WHEN (NEW.issue_number IS NULL)
    EXECUTE FUNCTION generate_issue_number();

-- Function to update completed_at when status changes to done
CREATE OR REPLACE FUNCTION update_issue_completion()
RETURNS TRIGGER AS $$
DECLARE
    status_closed BOOLEAN;
BEGIN
    -- Check if new status is a closed status
    SELECT is_closed INTO status_closed
    FROM task_statuses
    WHERE status_id = NEW.status_id;
    
    IF status_closed AND OLD.status_id != NEW.status_id THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    ELSIF NOT status_closed THEN
        NEW.completed_at = NULL;
    END IF;
    
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issue_completion ON task_issues;
CREATE TRIGGER trg_issue_completion
    BEFORE UPDATE ON task_issues
    FOR EACH ROW
    EXECUTE FUNCTION update_issue_completion();

-- Function to create default statuses when team is created
CREATE OR REPLACE FUNCTION create_default_task_statuses()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_statuses (team_id, name, status_type, color, icon, position, is_default, is_closed) VALUES
        (NEW.team_id, 'Backlog', 'backlog', '#6B7280', 'circle-dashed', 0, TRUE, FALSE),
        (NEW.team_id, 'Todo', 'todo', '#8B5CF6', 'circle', 1, FALSE, FALSE),
        (NEW.team_id, 'In Progress', 'in_progress', '#F59E0B', 'progress', 2, FALSE, FALSE),
        (NEW.team_id, 'Done', 'done', '#22C55E', 'check-circle', 3, FALSE, TRUE),
        (NEW.team_id, 'Cancelled', 'cancelled', '#EF4444', 'x-circle', 4, FALSE, TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_default_statuses ON teams;
CREATE TRIGGER trg_team_default_statuses
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION create_default_task_statuses();

-- ============================================================================
-- Create default statuses for existing teams (one-time migration)
-- ============================================================================
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT team_id FROM teams WHERE team_id NOT IN (SELECT DISTINCT team_id FROM task_statuses)
    LOOP
        INSERT INTO task_statuses (team_id, name, status_type, color, icon, position, is_default, is_closed) VALUES
            (t.team_id, 'Backlog', 'backlog', '#6B7280', 'circle-dashed', 0, TRUE, FALSE),
            (t.team_id, 'Todo', 'todo', '#8B5CF6', 'circle', 1, FALSE, FALSE),
            (t.team_id, 'In Progress', 'in_progress', '#F59E0B', 'progress', 2, FALSE, FALSE),
            (t.team_id, 'Done', 'done', '#22C55E', 'check-circle', 3, FALSE, TRUE),
            (t.team_id, 'Cancelled', 'cancelled', '#EF4444', 'x-circle', 4, FALSE, TRUE);
    END LOOP;
END $$;

-- ============================================================================
-- VIEWS for common queries
-- ============================================================================

-- View: Issues with all related info
CREATE OR REPLACE VIEW v_task_issues_full AS
SELECT 
    i.*,
    t.name AS team_name,
    UPPER(t.slug) AS team_identifier,
    CONCAT(UPPER(t.slug), '-', i.issue_number) AS full_identifier,
    s.name AS status_name,
    s.status_type,
    s.color AS status_color,
    s.icon AS status_icon,
    s.is_closed,
    p.name AS priority_name,
    p.level AS priority_level,
    p.color AS priority_color,
    a.display_name AS assignee_name,
    a.avatar_url AS assignee_avatar,
    c.display_name AS creator_name,
    cyc.name AS cycle_name,
    (SELECT COUNT(*) FROM task_issues sub WHERE sub.parent_issue_id = i.issue_id) AS sub_issues_count,
    (SELECT COUNT(*) FROM task_issue_comments com WHERE com.issue_id = i.issue_id AND com.deleted_at IS NULL) AS comments_count
FROM task_issues i
JOIN teams t ON i.team_id = t.team_id
JOIN task_statuses s ON i.status_id = s.status_id
LEFT JOIN task_priorities p ON i.priority_id = p.priority_id
LEFT JOIN account_users a ON i.assignee_id = a.user_id
LEFT JOIN account_users c ON i.creator_id = c.user_id
LEFT JOIN task_cycles cyc ON i.cycle_id = cyc.cycle_id
WHERE i.archived_at IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
