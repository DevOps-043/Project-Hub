-- =====================================================
-- Migration: 016_update_lockout_policy.sql
-- Descripción: Actualiza la política de bloqueo a 3 intentos y 30 segundos
-- Fecha: 2026-02-25
-- =====================================================

CREATE OR REPLACE FUNCTION handle_failed_login(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_attempts INTEGER;
  v_max_attempts INTEGER := 3; -- Reducido de 5 a 3 intentos
  v_lockout_seconds INTEGER := 30; -- Reducido de 15 minutos a 30 segundos
BEGIN
  -- Incrementar intentos fallidos
  UPDATE public.account_users 
  SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING failed_login_attempts INTO v_attempts;
  
  -- Si alcanza el máximo, bloquear cuenta
  IF v_attempts >= v_max_attempts THEN
    UPDATE public.account_users 
    SET locked_until = NOW() + (v_lockout_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
