-- ============================================================================
-- User Notification Preferences
-- Migration: 014_notification_preferences.sql
-- Description: Stores per-user notification preferences (email, SOFLIA, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.account_users(user_id) ON DELETE CASCADE,

    -- Canales de notificacion
    email_daily_summary BOOLEAN DEFAULT true,
    soflia_enabled BOOLEAN DEFAULT false,

    -- Granularidad SOFLIA: que tipo de eventos notificar
    soflia_issues BOOLEAN DEFAULT true,
    soflia_projects BOOLEAN DEFAULT true,
    soflia_team_updates BOOLEAN DEFAULT true,
    soflia_mentions BOOLEAN DEFAULT true,
    soflia_reminders BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_user_notification_prefs UNIQUE (user_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_soflia ON public.user_notification_preferences(user_id) WHERE soflia_enabled = true;

-- Trigger updated_at
CREATE TRIGGER trigger_notification_prefs_updated_at
    BEFORE UPDATE ON public.user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification preferences"
    ON public.user_notification_preferences
    FOR ALL
    USING (true)
    WITH CHECK (true);
