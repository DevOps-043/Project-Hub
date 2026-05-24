/**
 * DIAGNÓSTICO TEMPORAL — eliminar después de resolver el problema de API key.
 *
 * GET /api/debug/gemini-env
 *
 * Devuelve qué variables de entorno relacionadas con Gemini están definidas
 * en el runtime de Netlify (sin exponer el valor completo, solo prefijo+sufijo).
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mask(value: string | undefined): string {
  if (!value) return '<undefined>';
  if (value.length === 0) return '<empty string>';
  if (value.length <= 10) return `<${value.length} chars> ${value}`;
  return `<${value.length} chars> ${value.slice(0, 8)}...${value.slice(-4)}`;
}

export async function GET() {
  const keys = [
    'GOOGLE_API_KEY',
    'GOOGLE_AI_API_KEY',
    'GOOGLE_AI_KEY',
    'GEMINI_API_KEY',
    'NEXT_GOOGLE_API_KEY',
    'NEXT_PUBLIC_GOOGLE_AI_KEY',
    'NEXT_PUBLIC_GOOGLE_API_KEY',
    'GEMINI_MODEL',
  ];

  const result: Record<string, string> = {};
  for (const k of keys) {
    result[k] = mask(process.env[k]);
  }

  // ¿Cuál se selecciona con la lógica del código?
  const selected =
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_AI_KEY ||
    '';

  return NextResponse.json({
    env_vars: result,
    selected_apikey: mask(selected),
    node_env: process.env.NODE_ENV,
    netlify_context: process.env.CONTEXT || '<not set>',
  });
}
