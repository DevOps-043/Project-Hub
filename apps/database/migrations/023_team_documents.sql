-- ============================================================================
-- MIGRACION 023: Sistema de Documentos de Equipo (Google Drive Integration)
-- Descripcion: Tabla para vincular documentos externos (Google Drive/Sheets/Docs)
--              a equipos. Espejo de pm_project_documents (migracion 015) a nivel
--              equipo. IRIS actua como SoR del vinculo, el satelite (Drive) es
--              dueno del contenido dinamico.
-- ============================================================================

-- TABLA: team_documents
CREATE TABLE IF NOT EXISTS public.team_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,

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
CREATE INDEX IF NOT EXISTS idx_team_docs_team ON public.team_documents(team_id);
CREATE INDEX IF NOT EXISTS idx_team_docs_provider ON public.team_documents(provider);
CREATE INDEX IF NOT EXISTS idx_team_docs_external_id ON public.team_documents(external_id);

-- Trigger para auto-update de updated_at
CREATE TRIGGER trigger_team_documents_updated_at
    BEFORE UPDATE ON public.team_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.team_documents ENABLE ROW LEVEL SECURITY;

-- Constraint unico: un archivo externo solo puede vincularse una vez por equipo
ALTER TABLE public.team_documents
    ADD CONSTRAINT unique_team_external_doc UNIQUE (team_id, external_id);

-- Comentarios
COMMENT ON TABLE public.team_documents IS 'Vinculos de documentos externos (Google Drive/Sheets/Docs) a equipos. SoR del vinculo, no del contenido.';
COMMENT ON COLUMN public.team_documents.external_id IS 'ID del archivo en el proveedor externo (ej: Google File ID)';
COMMENT ON COLUMN public.team_documents.provider IS 'Proveedor del documento: google_drive, google_sheets, google_docs, internal';
COMMENT ON COLUMN public.team_documents.doc_type IS 'Tipo de documento: spreadsheet, document, presentation, folder, other';
