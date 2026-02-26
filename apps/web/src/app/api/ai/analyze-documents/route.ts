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
  assignee_name: string | null;
  estimate_points: number | null;
  due_date: string | null;
  labels: string[];
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
      return NextResponse.json(
        { error: 'No se pudo leer ninguno de los documentos proporcionados.' },
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

    // 5. Obtener estado default del equipo
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

    if (!defaultStatusId) {
      return NextResponse.json(
        { error: 'El equipo no tiene estados configurados.' },
        { status: 400 }
      );
    }

    // 6. Construir prompt para Gemini
    const documentsText = documentContents
      .map((d) => `--- Documento: ${d.name} ---\n${d.content}`)
      .join('\n\n');

    const membersText = membersList.length > 0
      ? membersList.map((m) => `- ${m.name} (${m.email}) - Rol: ${m.role}`).join('\n')
      : 'No hay miembros asignados al equipo.';

    const prompt = `Eres un asistente experto en gestión de proyectos. Analiza los siguientes documentos de un proyecto y extrae TODAS las tareas, actividades, entregables o items de trabajo que se describen o se pueden inferir.

Para cada tarea proporciona:
- title: título conciso y claro de la tarea (máximo 100 caracteres)
- description: descripción detallada de lo que se debe hacer, incluyendo criterios de aceptación si los hay
- priority: nivel de prioridad basado en la urgencia/importancia descrita ("urgent", "high", "medium", "low")
- assignee_name: nombre EXACTO del miembro del equipo más adecuado para esta tarea basado en su rol, o null si no se puede determinar. IMPORTANTE: usa exactamente los nombres de la lista de miembros.
- estimate_points: puntos de esfuerzo estimados usando la escala Fibonacci (1, 2, 3, 5, 8, 13). Basa tu estimación en la complejidad descrita.
- due_date: fecha límite en formato YYYY-MM-DD si se menciona explícitamente en el documento, o null si no se menciona
- labels: array de etiquetas descriptivas relevantes (ej: ["backend", "diseño", "urgente", "investigación"])

Miembros disponibles del equipo:
${membersText}

Documentos del proyecto:
${documentsText}

INSTRUCCIONES IMPORTANTES:
1. Extrae TODAS las tareas posibles, incluso las implícitas
2. Sé específico en las descripciones, no genérico
3. Si el documento menciona responsables, intenta mapearlos a los miembros del equipo
4. Las etiquetas deben ser útiles para categorizar el trabajo
5. Responde ÚNICAMENTE con JSON válido, sin markdown, sin comentarios
6. Formato exacto de respuesta: {"issues": [...]}

Responde SOLO con el JSON:`;

    // 7. Enviar a Gemini
    const aiResponse = await generateText(prompt);

    // 8. Parsear respuesta
    let parsedIssues: ParsedIssue[];
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();

      const parsed = JSON.parse(cleanResponse);
      parsedIssues = parsed.issues || [];
    } catch (parseError) {
      console.error('Error parsing AI response:', aiResponse);
      return NextResponse.json(
        { error: 'La IA generó una respuesta inválida. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    if (parsedIssues.length === 0) {
      return NextResponse.json({
        message: 'No se detectaron tareas en los documentos.',
        issues: [],
        count: 0,
      });
    }

    // 9. Resolver assignees por nombre
    const nameToUserId: Record<string, string> = {};
    membersList.forEach((m) => {
      nameToUserId[m.name.toLowerCase()] = m.user_id;
    });

    // 10. Crear issues en batch
    const createdIssues: any[] = [];

    for (const issue of parsedIssues) {
      // Resolve assignee
      let assigneeId: string | null = null;
      if (issue.assignee_name) {
        const normalizedName = issue.assignee_name.toLowerCase();
        assigneeId = nameToUserId[normalizedName] || null;

        // Try partial match if exact match fails
        if (!assigneeId) {
          const match = Object.entries(nameToUserId).find(([name]) =>
            name.includes(normalizedName) || normalizedName.includes(name)
          );
          if (match) assigneeId = match[1];
        }
      }

      // Resolve priority
      const priorityKey = issue.priority?.toLowerCase() || 'medium';
      const priorityId = priorityMap[priorityKey] || priorityMap['medium'] || null;

      // Validate estimate points
      const validPoints = [1, 2, 3, 5, 8, 13, 21];
      const estimatePoints = issue.estimate_points && validPoints.includes(issue.estimate_points)
        ? issue.estimate_points
        : null;

      // Validate due date
      let dueDate: string | null = null;
      if (issue.due_date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(issue.due_date)) {
          dueDate = issue.due_date;
        }
      }

      const { data: created, error } = await supabase
        .from('task_issues')
        .insert({
          team_id: teamId,
          title: (issue.title || 'Tarea sin título').substring(0, 500),
          description: issue.description || null,
          status_id: defaultStatusId,
          priority_id: priorityId,
          assignee_id: assigneeId,
          project_id: projectId,
          creator_id: payload.sub,
          due_date: dueDate,
          estimate_points: estimatePoints,
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

      // Add labels if any
      if (issue.labels?.length > 0 && created) {
        for (const labelName of issue.labels) {
          // Try to find existing label or create new one
          const { data: existingLabel } = await supabase
            .from('task_labels')
            .select('label_id')
            .eq('team_id', teamId)
            .eq('name', labelName)
            .single();

          let labelId = existingLabel?.label_id;

          if (!labelId) {
            // Create label
            const { data: newLabel } = await supabase
              .from('task_labels')
              .insert({
                team_id: teamId,
                name: labelName.substring(0, 100),
                color: getRandomLabelColor(),
                created_by: payload.sub,
              })
              .select('label_id')
              .single();
            labelId = newLabel?.label_id;
          }

          if (labelId) {
            await supabase
              .from('task_issue_labels')
              .insert({ issue_id: created.issue_id, label_id: labelId })
              .select()
              .maybeSingle();
          }
        }
      }

      if (created) {
        // Get team slug for identifier
        const { data: team } = await supabase
          .from('teams')
          .select('slug')
          .eq('team_id', teamId)
          .single();

        const teamPrefix = team?.slug ? team.slug.toUpperCase() : 'TASK';
        createdIssues.push({
          ...created,
          identifier: `${teamPrefix}-${created.issue_number}`,
          suggested_labels: issue.labels || [],
        });
      }
    }

    return NextResponse.json({
      message: `Se crearon ${createdIssues.length} tareas automáticamente.`,
      issues: createdIssues,
      count: createdIssues.length,
      total_detected: parsedIssues.length,
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
