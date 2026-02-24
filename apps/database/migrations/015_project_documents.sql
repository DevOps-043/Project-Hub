-- ============================================================================
-- MIGRACION 015: Sistema de Documentos de Proyecto (Google Drive Integration)
-- Descripcion: Tabla para vincular documentos externos (Google Drive/Sheets/Docs)
--              a proyectos. IRIS actua como SoR del vinculo, el satelite (Drive)
--              es dueno del contenido dinamico.
-- ============================================================================

-- TABLA: pm_project_documents
CREATE TABLE IF NOT EXISTS public.pm_project_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.pm_projects(project_id) ON DELETE CASCADE,

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
CREATE INDEX IF NOT EXISTS idx_pm_docs_project ON public.pm_project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_docs_provider ON public.pm_project_documents(provider);
CREATE INDEX IF NOT EXISTS idx_pm_docs_external_id ON public.pm_project_documents(external_id);

-- Trigger para auto-update de updated_at
CREATE TRIGGER trigger_pm_project_documents_updated_at
    BEFORE UPDATE ON public.pm_project_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.pm_project_documents ENABLE ROW LEVEL SECURITY;

-- Constraint unico: un archivo externo solo puede vincularse una vez por proyecto
ALTER TABLE public.pm_project_documents
    ADD CONSTRAINT unique_project_external_doc UNIQUE (project_id, external_id);

-- Comentarios
COMMENT ON TABLE public.pm_project_documents IS 'Vinculos de documentos externos (Google Drive/Sheets/Docs) a proyectos. SoR del vinculo, no del contenido.';
COMMENT ON COLUMN public.pm_project_documents.external_id IS 'ID del archivo en el proveedor externo (ej: Google File ID)';
COMMENT ON COLUMN public.pm_project_documents.provider IS 'Proveedor del documento: google_drive, google_sheets, google_docs, internal';
COMMENT ON COLUMN public.pm_project_documents.doc_type IS 'Tipo de documento: spreadsheet, document, presentation, folder, other';
