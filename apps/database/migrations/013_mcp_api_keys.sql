-- =============================================
-- Migration 013: MCP API Keys
-- Sistema de API Keys para el Bridge MCP
-- =============================================

-- Tabla principal de API Keys
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  key_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(workspace_id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES public.account_users(user_id) ON DELETE CASCADE,

  -- Identificacion
  name            VARCHAR(100) NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      VARCHAR(12) NOT NULL,

  -- Permisos
  scopes          TEXT[] DEFAULT ARRAY['read','write'],

  -- Estado
  is_active       BOOLEAN DEFAULT true,

  -- Uso
  last_used_at    TIMESTAMPTZ,
  total_requests  BIGINT DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_workspace ON public.mcp_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_hash ON public.mcp_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_prefix ON public.mcp_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_active ON public.mcp_api_keys(workspace_id, is_active);

-- Trigger para updated_at
CREATE TRIGGER trigger_mcp_api_keys_updated_at
  BEFORE UPDATE ON public.mcp_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (auth manejada en la capa de aplicacion con service role)
ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcp_api_keys_service_policy ON public.mcp_api_keys
  FOR ALL USING (true);
