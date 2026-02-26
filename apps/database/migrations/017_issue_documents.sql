-- ============================================================================
-- MIGRACION 017: Sistema de Documentos de Issues (Google Drive Integration)
-- Descripcion: Tabla para vincular documentos externos (Google Drive/Sheets/Docs)
--              a issues. Espejo de pm_project_documents (migracion 015) pero
--              vinculado a task_issues en lugar de pm_projects.
-- Fecha: 2026-02-25
-- ============================================================================

-- TABLA: task_issue_documents
CREATE TABLE IF NOT EXISTS public.task_issue_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id        UUID NOT NULL REFERENCES public.task_issues(issue_id) ON DELETE CASCADE,

    -- Informacion del documento
    name            TEXT NOT NULL,
    provider        TEXT NOT NULL DEFAULT 'google_drive'
                    CHECK (provider IN ('google_drive', 'google_sheets', 'google_docs', 'internal')),
    external_id     TEXT NOT NULL,                          -- Google File ID
    external_url    TEXT NOT NULL,                          -- Link directo al archivo
    doc_type        TEXT NOT NULL DEFAULT 'document'
                    CHECK (doc_type IN ('spreadsheet', 'document', 'presentation', 'folder', 'other')),
    mime_type       TEXT,                                   -- application/vnd.google-apps.spreadsheet, etc.
    thumbnail_url   TEXT,                                   -- URL de miniatura de Google

    -- Auditoria
    created_by      UUID NOT NULL REFERENCES public.account_users(user_id),
    metadata        JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_task_docs_issue ON public.task_issue_documents(issue_id);
CREATE INDEX IF NOT EXISTS idx_task_docs_provider ON public.task_issue_documents(provider);
CREATE INDEX IF NOT EXISTS idx_task_docs_external_id ON public.task_issue_documents(external_id);

-- Trigger para auto-update de updated_at
CREATE TRIGGER trigger_task_issue_documents_updated_at
    BEFORE UPDATE ON public.task_issue_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.task_issue_documents ENABLE ROW LEVEL SECURITY;

-- Constraint unico: un archivo externo solo puede vincularse una vez por issue
ALTER TABLE public.task_issue_documents
    ADD CONSTRAINT unique_issue_external_doc UNIQUE (issue_id, external_id);

-- Comentarios
COMMENT ON TABLE public.task_issue_documents IS 'Vinculos de documentos externos (Google Drive/Sheets/Docs) a issues. SoR del vinculo, no del contenido.';
COMMENT ON COLUMN public.task_issue_documents.external_id IS 'ID del archivo en el proveedor externo (ej: Google File ID)';
COMMENT ON COLUMN public.task_issue_documents.provider IS 'Proveedor del documento: google_drive, google_sheets, google_docs, internal';
COMMENT ON COLUMN public.task_issue_documents.doc_type IS 'Tipo de documento: spreadsheet, document, presentation, folder, other';
