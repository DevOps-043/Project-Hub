import { NextRequest } from 'next/server';
import { ApiError, fail, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (process.env.PROJECT_HUB_API_V1 === 'false') {
      throw new ApiError(503, 'FEATURE_DISABLED', 'Project Hub API v1 no está habilitada');
    }

    // Consulta mínima sin devolver información de negocio. Comprueba que el
    // runtime de Netlify recibió la configuración y puede alcanzar Supabase.
    const { error } = await getSupabaseAdmin()
      .from('workspaces')
      .select('workspace_id', { count: 'exact', head: true });

    if (error) {
      console.error('[ProjectHubHealth] Database check failed:', error.code || 'unknown');
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'La base de datos de Project Hub no está disponible');
    }

    return ok(request, {
      status: 'ok',
      api: 'project-hub-v1',
      database: 'connected',
    }, { status: 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return fail(request, error);
  }
}
