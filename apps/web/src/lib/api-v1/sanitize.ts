import { ApiError } from './http';

const BLOCKED_PROTOCOLS = new Set(['file:', 'data:', 'javascript:', 'chrome:', 'edge:', 'about:', 'devtools:']);
const SENSITIVE_QUERY = /^(token|access_token|refresh_token|code|key|api_key|apikey|password|passwd|secret|session|auth|signature|sig)$/i;

export function sanitizeExternalUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ApiError(400, 'INVALID_URL', 'URL inválida'); }
  if (BLOCKED_PROTOCOLS.has(url.protocol) || !['http:', 'https:'].includes(url.protocol)) {
    throw new ApiError(400, 'URL_PROTOCOL_BLOCKED', 'El esquema de URL no está permitido');
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (SENSITIVE_QUERY.test(key)) url.searchParams.delete(key);
  return url.toString();
}

export function sanitizeEvidenceItems(items: Array<Record<string, unknown>>) {
  return items.map((item) => ({
    ...item,
    ...(typeof item.source_url === 'string' ? { source_url: sanitizeExternalUrl(item.source_url) } : {}),
    ...(typeof item.content === 'string' ? { content: item.content.replace(/\u0000/g, '').slice(0, 51_200) } : {}),
  }));
}

