import { NextRequest, NextResponse } from 'next/server';
import { ChatMessage, geminiConfig, streamChatResponse } from '@/lib/ai/gemini';
import { getARIASystemPrompt, ARIAContext, ARIATaskSummary } from '@/lib/ai/lia-agent';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-role';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ChatRequest {
  messages: ChatMessage[];
  context?: ARIAContext;
  stream?: boolean;
}

/**
 * Antes esta ruta confiaba en context.userId/context.teamId tal como
 * llegaban en el body: cualquier usuario autenticado (con cualquier rol)
 * podía leer tareas y proyectos de un equipo ajeno con solo mandar otro
 * teamId, y registrar uso/adjuntos a nombre de otro userId. userId sale
 * siempre del token; teamId solo se usa si el caller es miembro real.
 */
interface RawTaskSummaryRow {
  title: string;
  issue_number: number | null;
  due_date: string | null;
  status: { name: string | null; status_type: string | null } | { name: string | null; status_type: string | null }[] | null;
  priority: { name: string | null } | { name: string | null }[] | null;
}

/**
 * Sin generar Database types, supabase-js a veces infiere las relaciones
 * embebidas (FK many-to-one) como arreglo aunque en runtime sea un objeto
 * único; se normaliza aquí para no propagar ese ruido al tipo ARIATaskSummary.
 */
function normalizeTaskSummaries(rows: RawTaskSummaryRow[]): ARIATaskSummary[] {
  return rows.map((row) => ({
    title: row.title,
    issue_number: row.issue_number ?? undefined,
    due_date: row.due_date,
    status: Array.isArray(row.status) ? (row.status[0] ?? null) : row.status,
    priority: Array.isArray(row.priority) ? (row.priority[0] ?? null) : row.priority,
  }));
}

async function verifyTeamMembership(userId: string, teamId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from('team_members')
    .select('member_id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

async function enrichContext(requestedContext: ARIAContext | undefined, authenticatedUserId: string): Promise<ARIAContext | undefined> {
  const context: ARIAContext = requestedContext
    ? { ...requestedContext, userId: authenticatedUserId }
    : { userId: authenticatedUserId };

  if (context.teamId && !(await verifyTeamMembership(authenticatedUserId, context.teamId))) {
    // No es miembro de ese equipo: se ignora el teamId en vez de filtrar
    // datos de un equipo ajeno.
    delete context.teamId;
    delete context.teamName;
  }

  if (!context.teamId && !context.userId) return context;

  try {
    const supabase = getSupabaseAdmin();
    const enriched: ARIAContext = { ...context };

    if (context.teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('team_id', context.teamId)
        .maybeSingle();

      if (team?.name) {
        enriched.teamName = team.name;
      }

      const { data: tasks } = await supabase
        .from('task_issues')
        .select('title, issue_number, due_date, status:task_statuses(name, status_type), priority:task_priorities(name)')
        .eq('team_id', context.teamId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (tasks) {
        enriched.tasks = normalizeTaskSummaries(tasks);
      }

      const { data: projects } = await supabase
        .from('pm_projects')
        .select('project_name, project_status, project_key')
        .eq('team_id', context.teamId)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (projects) {
        enriched.projects = projects;
      }
    } else if (context.userId) {
      // Sin teamId: cargar las tareas asignadas al usuario en cualquier equipo,
      // para que ARIA pueda responder "mis pendientes" desde el dashboard global.
      const { data: tasks } = await supabase
        .from('task_issues')
        .select('title, issue_number, due_date, status:task_statuses(name, status_type), priority:task_priorities(name)')
        .eq('assignee_id', context.userId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (tasks) {
        enriched.tasks = normalizeTaskSummaries(tasks);
      }
    }

    return enriched;
  } catch (error) {
    console.error('ARIA context enrichment failed:', error);
    return context;
  }
}

async function persistAttachments(messages: ChatMessage[], context?: ARIAContext) {
  const lastMessage = messages[messages.length - 1] as ChatMessage & {
    attachments?: Array<{ name?: string; mimeType: string; data: string }>;
  };

  if (!context?.userId || lastMessage?.role !== 'user' || !lastMessage.attachments?.length) {
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    for (const attachment of lastMessage.attachments) {
      const buffer = Buffer.from(attachment.data, 'base64');
      const safeName = (attachment.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${context.userId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('aria-attachments')
        .upload(storagePath, buffer, {
          contentType: attachment.mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('ARIA attachment upload failed:', uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from('aria-attachments').getPublicUrl(storagePath);

      await supabase.from('aria_chat_attachments').insert({
        user_id: context.userId,
        team_id: context.teamId || null,
        file_name: attachment.name || safeName,
        file_type: attachment.mimeType,
        file_size: buffer.length,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
      });
    }
  } catch (error) {
    console.error('ARIA attachment persistence failed:', error);
  }
}

function createStream(messages: ChatMessage[], systemPrompt: string, context?: ARIAContext) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let responseText = '';

      try {
        for await (const content of streamChatResponse(messages, systemPrompt)) {
          responseText += content;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();

        if (context?.userId) {
          logApproximateUsage(context, messages, responseText);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error interno de ARIA';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `No pude responder: ${message}`, done: false })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      }
    },
  });
}

function logApproximateUsage(context: ARIAContext, messages: ChatMessage[], responseText: string) {
  try {
    const inputChars = messages.map((message) => message.content || '').join('\n').length;
    const outputChars = responseText.length;
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);

    getSupabaseAdmin()
      .from('aria_usage_logs')
      .insert({
        user_id: context.userId,
        team_id: context.teamId || null,
        model: geminiConfig.model || 'unknown',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        interaction_type: 'chat',
        status: 'success',
      })
      .then(({ error }) => {
        if (error) {
          console.error('ARIA usage logging failed:', error.message);
        }
      });
  } catch (error) {
    console.error('ARIA usage logging exception:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const body: ChatRequest = await request.json();
    const { messages, stream = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un mensaje.' }, { status: 400 });
    }

    if (!geminiConfig.apiKey) {
      return NextResponse.json(
        { error: 'No hay API key de Gemini configurada en el entorno.' },
        { status: 500 }
      );
    }

    const context = await enrichContext(body.context, auth.payload.sub);
    await persistAttachments(messages, context);

    const systemPrompt = getARIASystemPrompt(context);

    if (!stream) {
      let content = '';
      for await (const chunk of streamChatResponse(messages, systemPrompt)) {
        content += chunk;
      }
      if (context?.userId) {
        logApproximateUsage(context, messages, content);
      }
      return NextResponse.json({ message: { role: 'assistant', content } });
    }

    return new Response(createStream(messages, systemPrompt, context), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('ARIA chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno de ARIA.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ready', message: 'ARIA Chat API Ready' });
}
