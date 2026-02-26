/**
 * API Route: /api/ai/analyze-documents
 * POST: Analiza documentos de Google Drive con IA y crea issues automaticamente
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/auth/token-encryption';
import { readMultipleDocuments } from '@/lib/google/drive-reader';
import { generateText } from '@/lib/ai/gemini';
import { addDays } from 'date-fns';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for AI processing

interface DocumentInput {
  external_id: string;
  mime_type: string;
  name: string;
}

interface ParsedIssue {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status_type: 'backlog' | 'todo' | 'in_progress' | null;
  assignee_name: string | null;
  estimate_points: number | null;
  due_date: string | null;
  labels: string[];
  cycle_name: string | null;
}

interface ParsedCycle {
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, teamId, documents } = body as {
      projectId: string;
      teamId: string;
      documents: DocumentInput[];
    };

    if (!projectId || !teamId || !documents?.length) {
      return NextResponse.json(
        { error: 'Se requiere projectId, teamId y al menos un documento' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Obtener Google access token del usuario
    const { data: oauthProvider } = await supabase
      .from('auth_oauth_providers')
      .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
      .eq('user_id', payload.sub)
      .eq('provider_name', 'google')
      .single();

    if (!oauthProvider) {
      return NextResponse.json(
        { error: 'Google Drive no está conectado. Conecta tu cuenta de Google primero.' },
        { status: 400 }
      );
    }

    // Refresh token if expired
    let googleAccessToken: string;
    const now = new Date();
    const expiresAt = new Date(oauthProvider.token_expires_at);

    if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
      googleAccessToken = await decryptToken(oauthProvider.access_token_encrypted);
    } else {
      // Refresh the token
      if (!oauthProvider.refresh_token_encrypted) {
        return NextResponse.json(
          { error: 'Token de Google expirado. Reconecta tu cuenta.' },
          { status: 401 }
        );
      }

      const refreshToken = await decryptToken(oauthProvider.refresh_token_encrypted);
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshRes.ok) {
        return NextResponse.json(
          { error: 'No se pudo refrescar el token de Google. Reconecta tu cuenta.' },
          { status: 401 }
        );
      }

      const refreshData = await refreshRes.json();
      googleAccessToken = refreshData.access_token;
    }

    // 2. Leer contenido de los documentos
    const documentContents = await readMultipleDocuments(googleAccessToken, documents);

    if (documentContents.length === 0) {
      // Intentar detectar si fue por error de permisos (403) revisando los logs previos o asumiendo el caso común
      return NextResponse.json(
        { 
          error: 'No se pudo leer ninguno de los documentos. Por favor, desconecta y vuelve a conectar tu cuenta de Google permitiendo el acceso de lectura.',
          code: 'GOOGLE_AUTH_REQUIRED'
        },
        { status: 400 }
      );
    }

    // 3. Obtener miembros del equipo
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select(`
        role,
        user:account_users!team_members_user_id_fkey(
          user_id, first_name, last_name_paternal, display_name, email
        )
      `)
      .eq('team_id', teamId);

    const membersList = (teamMembers || []).map((m: any) => ({
      user_id: m.user.user_id,
      name: m.user.display_name || `${m.user.first_name} ${m.user.last_name_paternal}`,
      email: m.user.email,
      role: m.role,
    }));

    // 4. Obtener prioridades disponibles
    const { data: priorities } = await supabase
      .from('task_priorities')
      .select('priority_id, name, level')
      .order('level');

    const priorityMap: Record<string, string> = {};
    (priorities || []).forEach((p: any) => {
      const key = p.name.toLowerCase();
      priorityMap[key] = p.priority_id;
      // Map Spanish names too
      if (key === 'urgent') priorityMap['urgente'] = p.priority_id;
      if (key === 'high') priorityMap['alta'] = p.priority_id;
      if (key === 'medium') priorityMap['media'] = p.priority_id;
      if (key === 'low') priorityMap['baja'] = p.priority_id;
    });

    // 5. Obtener estado default del equipo (o crear estados por defecto)
    const { data: defaultStatus } = await supabase
      .from('task_statuses')
      .select('status_id')
      .eq('team_id', teamId)
      .eq('is_default', true)
      .single();

    let defaultStatusId = defaultStatus?.status_id;
    if (!defaultStatusId) {
      const { data: firstStatus } = await supabase
        .from('task_statuses')
        .select('status_id')
        .eq('team_id', teamId)
        .order('position')
        .limit(1)
        .single();
      defaultStatusId = firstStatus?.status_id;
    }

    // Si no hay estados, crear los default automáticamente
    if (!defaultStatusId) {
      console.log('⚙️ [AI] Creando estados por defecto para equipo:', teamId);
      const defaultStatuses = [
        { name: 'Backlog',     status_type: 'backlog',     color: '#6B7280', icon: 'circle-dashed', position: 0, is_default: true,  is_closed: false },
        { name: 'Todo',        status_type: 'todo',         color: '#3B82F6', icon: 'circle',        position: 1, is_default: false, is_closed: false },
        { name: 'In Progress', status_type: 'in_progress',  color: '#F59E0B', icon: 'loader',        position: 2, is_default: false, is_closed: false },
        { name: 'In Review',   status_type: 'in_review',    color: '#8B5CF6', icon: 'eye',           position: 3, is_default: false, is_closed: false },
        { name: 'Done',        status_type: 'done',        color: '#10B981', icon: 'check-circle',  position: 4, is_default: false, is_closed: true  },
        { name: 'Cancelled',   status_type: 'cancelled',   color: '#EF4444', icon: 'x-circle',      position: 5, is_default: false, is_closed: true  },
      ];

      const { data: createdStatuses, error: statusError } = await supabase
        .from('task_statuses')
        .insert(defaultStatuses.map(s => ({ ...s, team_id: teamId })))
        .select('status_id, is_default');

      if (statusError || !createdStatuses?.length) {
        console.error('❌ [AI] Error creando estados:', statusError);
        return NextResponse.json(
          { error: 'No se pudieron crear los estados del equipo. Configúralos manualmente.' },
          { status: 500 }
        );
      }

      defaultStatusId = createdStatuses.find(s => s.is_default)?.status_id || createdStatuses[0].status_id;
      console.log('✅ [AI] Estados creados exitosamente. Default:', defaultStatusId);
    }

    // 5.5 Construir mapa status_type -> status_id para asignar estados variados
    const { data: allTeamStatuses } = await supabase
      .from('task_statuses')
      .select('status_id, status_type, is_default')
      .eq('team_id', teamId)
      .order('position');

    const statusTypeMap: Record<string, string> = {};
    (allTeamStatuses || []).forEach((s: any) => {
      statusTypeMap[s.status_type] = s.status_id;
    });

    // Asegurar que defaultStatusId esta definido
    if (!defaultStatusId) {
      const defaultRow = (allTeamStatuses || []).find((s: any) => s.is_default);
      defaultStatusId = defaultRow?.status_id || (allTeamStatuses || [])[0]?.status_id;
    }

    // 6. Construir prompt para Gemini
    const documentsText = documentContents
      .map((d) => `--- Documento: ${d.name} ---\n${d.content}`)
      .join('\n\n');

    const membersText = membersList.length > 0
      ? membersList.map((m) => `- ${m.name} (${m.email}) - Rol: ${m.role}`).join('\n')
      : 'No hay miembros asignados al equipo.';

    const today = new Date().toISOString().split('T')[0];

    const prompt = `Eres SofLIA, un asistente experto en planificación y gestión de proyectos. Analiza los siguientes documentos y genera un plan de trabajo completo con ciclos (fases de trabajo) y tareas.

## QUÉ SON LOS CICLOS
Los ciclos son **fases o etapas de trabajo** con fechas definidas. Aplican a cualquier tipo de proyecto: empresarial, académico, creativo, técnico, etc. Cada ciclo agrupa tareas relacionadas que deben completarse en ese periodo.

## FORMATO DE RESPUESTA
Responde ÚNICAMENTE con JSON válido (sin markdown, sin comentarios, sin texto adicional):
{
  "cycles": [
    {
      "name": "Nombre de la fase/etapa",
      "description": "Objetivo principal de esta fase",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD"
    }
  ],
  "issues": [
    {
      "title": "Título conciso (máx 100 chars)",
      "description": "Descripción detallada de qué se debe hacer y qué entregable se espera",
      "priority": "urgent|high|medium|low",
      "status_type": "backlog|todo|in_progress",
      "assignee_name": "Nombre exacto del miembro o null",
      "estimate_points": 3,
      "due_date": "YYYY-MM-DD o null",
      "labels": ["etiqueta1", "etiqueta2"],
      "cycle_name": "Nombre exacto del ciclo o null"
    }
  ]
}

## REGLAS PARA CICLOS
- Identifica las fases o etapas naturales que los documentos sugieren (ej: "Investigación", "Diseño", "Desarrollo", "Implementación", "Lanzamiento", etc.).
- Si los documentos no tienen fechas explícitas, genera ciclos lógicos empezando desde la fecha actual (${today}), con duraciones razonables según la complejidad.
- Las fechas de los ciclos deben ser consecutivas y no solaparse.
- Cada ciclo debe tener un objetivo/scope claro descrito en su description.

## REGLAS PARA ISSUES (TAREAS)
- Extrae TODAS las tareas, actividades, entregables o items de trabajo posibles del contenido de los documentos.
- **status_type**: "todo" para tareas del primer ciclo o listas para comenzar, "backlog" para tareas de ciclos futuros o sin prioridad inmediata, "in_progress" SOLO si el documento indica explícitamente que ya se está trabajando en ello.
- **priority**: "urgent" para bloqueantes o con fecha límite cercana, "high" para importantes, "medium" para regulares, "low" para mejoras o tareas opcionales.
- **estimate_points**: Escala Fibonacci - 1 (trivial), 2 (simple), 3 (mediano), 5 (complejo), 8 (muy complejo), 13 (épico).
- **assignee_name**: Asigna SOLO si puedes inferir claramente quién debería hacerlo. Usa el nombre EXACTO de la lista de miembros. Si no es claro, usa null.
- **labels**: Etiquetas descriptivas relevantes al contenido (ej: "diseño", "documentación", "investigación", "logística", "comunicación", "presupuesto", etc.).
- **cycle_name**: DEBE coincidir exactamente con el "name" de un ciclo del array cycles.
- **due_date**: Debe estar dentro del rango de fechas del ciclo asignado. Si no hay fecha específica, usa null.

## MIEMBROS DEL EQUIPO DISPONIBLES
${membersText}

## DOCUMENTOS DEL PROYECTO
${documentsText}

## FECHA ACTUAL
${today}

Genera el plan completo en JSON válido.`;

    // 7. Enviar a Gemini
    const aiResponse = await generateText(prompt);

    // 8. Parsear respuesta
    let parsedIssues: ParsedIssue[];
    let parsedCycles: ParsedCycle[];
    try {
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.slice(7);
      else if (cleanResponse.startsWith('```')) cleanResponse = cleanResponse.slice(3);
      if (cleanResponse.endsWith('```')) cleanResponse = cleanResponse.slice(0, -3);
      cleanResponse = cleanResponse.trim();

      const parsed = JSON.parse(cleanResponse);
      parsedIssues = parsed.issues || [];
      parsedCycles = parsed.cycles || [];
    } catch (parseError) {
      console.error('Error parsing AI response:', aiResponse);
      return NextResponse.json({ error: 'La IA generó una respuesta inválida.' }, { status: 500 });
    }

    // 9. Resolver assignees y ciclos
    const nameToUserId: Record<string, string> = {};
    membersList.forEach((m) => nameToUserId[m.name.toLowerCase()] = m.user_id);

    // 10. Crear ciclos si no existen
    const cycleNameToId: Record<string, string> = {};

    // Obtener el max cycle_number actual del equipo
    const { data: lastCycleData } = await supabase
      .from('task_cycles')
      .select('cycle_number')
      .eq('team_id', teamId)
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextCycleNumber = (lastCycleData?.cycle_number || 0) + 1;
    const todayStr = new Date().toISOString().split('T')[0];

    for (const c of parsedCycles) {
      // Buscar si ya existe un ciclo con ese nombre en el equipo
      const { data: existingCycle } = await supabase
        .from('task_cycles')
        .select('cycle_id')
        .eq('team_id', teamId)
        .eq('name', c.name)
        .maybeSingle();

      if (existingCycle) {
        cycleNameToId[c.name.toLowerCase()] = existingCycle.cycle_id;
      } else {
        // Determinar fechas con fallback
        const startDate = c.start_date || todayStr;
        const endDate = c.end_date || addDays(new Date(startDate), 42).toISOString().split('T')[0];

        // Determinar status basado en fechas
        let cycleStatus: string;
        if (startDate > todayStr) {
          cycleStatus = 'upcoming';
        } else if (endDate >= todayStr) {
          cycleStatus = 'active';
        } else {
          cycleStatus = 'completed';
        }

        const { data: newCycle, error: cycleError } = await supabase
          .from('task_cycles')
          .insert({
            team_id: teamId,
            cycle_number: nextCycleNumber,
            name: c.name,
            description: c.description,
            start_date: startDate,
            end_date: endDate,
            status: cycleStatus,
            created_by: payload.sub,
          })
          .select('cycle_id')
          .single();

        if (cycleError) {
          console.error('Error creating cycle:', c.name, cycleError);
          continue;
        }
        if (newCycle) {
          cycleNameToId[c.name.toLowerCase()] = newCycle.cycle_id;
          nextCycleNumber++;
        }
      }
    }

    // 11. Crear issues en batch
    const createdIssues: any[] = [];
    for (const issue of parsedIssues) {
      let assigneeId: string | null = null;
      if (issue.assignee_name) {
        const normalizedName = issue.assignee_name.toLowerCase();
        assigneeId = nameToUserId[normalizedName] || null;
      }

      const priorityKey = issue.priority?.toLowerCase() || 'medium';
      const priorityId = priorityMap[priorityKey] || priorityMap['medium'] || null;

      const cycleId = issue.cycle_name ? cycleNameToId[issue.cycle_name.toLowerCase()] : null;

      // Resolver status_id desde el status_type sugerido por la IA
      const issueStatusType = issue.status_type?.toLowerCase();
      const resolvedStatusId = (issueStatusType && statusTypeMap[issueStatusType])
        ? statusTypeMap[issueStatusType]
        : defaultStatusId;

      const { data: created, error } = await supabase
        .from('task_issues')
        .insert({
          team_id: teamId,
          title: (issue.title || 'Tarea sin título').substring(0, 500),
          description: issue.description || null,
          status_id: resolvedStatusId,
          priority_id: priorityId,
          assignee_id: assigneeId,
          project_id: projectId,
          cycle_id: cycleId,
          creator_id: payload.sub,
          due_date: issue.due_date,
          estimate_points: issue.estimate_points,
          sort_order: 0,
        })
        .select(`
          *,
          status:task_statuses(status_id, name, status_type, color),
          priority:task_priorities(priority_id, name, level, color),
          assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, first_name, last_name_paternal, avatar_url)
        `)
        .single();

      if (error) {
        console.error('Error creating issue:', error);
        continue;
      }

      // Labels
      if (issue.labels?.length > 0 && created) {
        for (const labelName of issue.labels) {
          const { data: existingLabel } = await supabase
            .from('task_labels')
            .select('label_id')
            .eq('team_id', teamId)
            .eq('name', labelName)
            .single();

          let labelId = existingLabel?.label_id;
          if (!labelId) {
            const { data: newLabel } = await supabase.from('task_labels').insert({
              team_id: teamId,
              name: labelName.substring(0, 100),
              color: getRandomLabelColor(),
              created_by: payload.sub
            }).select('label_id').single();
            labelId = newLabel?.label_id;
          }
          if (labelId) {
            await supabase.from('task_issue_labels').insert({ issue_id: created.issue_id, label_id: labelId }).maybeSingle();
          }
        }
      }

      if (created) createdIssues.push(created);
    }

    const cyclesCreatedCount = Object.keys(cycleNameToId).length;

    return NextResponse.json({
      message: `SofLIA detectó ${cyclesCreatedCount} ciclos y creó ${createdIssues.length} tareas automáticamente.`,
      issues_count: createdIssues.length,
      cycles_count: cyclesCreatedCount,
      cycles_created: Object.entries(cycleNameToId).map(([name, id]) => ({ name, cycle_id: id })),
    });
  } catch (error) {
    console.error('Error in analyze-documents:', error);
    return NextResponse.json({ error: 'Error interno al analizar documentos' }, { status: 500 });
  }
}

function getRandomLabelColor(): string {
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];
  return colors[Math.floor(Math.random() * colors.length)];
}
