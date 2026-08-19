import type { NextRequest } from 'next/server';
import { verifyApiKey } from '@/lib/services/api-key-service';

export type BridgeAuth = {
  authenticated: boolean;
  workspaceId?: string;
  scopes?: string[];
  keyName?: string;
  createdBy?: string;
  error?: string;
};

export type ActionBody = {
  tool?: string;
  action?: string;
  name?: string;
  params?: Record<string, any>;
  arguments?: Record<string, any>;
  [key: string]: unknown;
};

export type BridgeErrorResponse = {
  error: string;
  status: number;
};

/**
 * Authenticates bridge requests.
 * Supports database API keys (phub_...) and legacy IRIS_AGENT_KEY.
 */
export async function authenticateBridgeRequest(request: NextRequest): Promise<BridgeAuth> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  if (token.startsWith('phub_')) {
    const result = await verifyApiKey(token);
    if (!result || !result.valid) {
      return { authenticated: false, error: 'Invalid or revoked API key' };
    }
    return {
      authenticated: true,
      workspaceId: result.workspaceId,
      scopes: result.keyRecord.scopes,
      keyName: result.keyRecord.name,
      createdBy: result.keyRecord.created_by,
    };
  }

  const legacyKey = process.env.IRIS_AGENT_KEY;
  if (legacyKey && token === legacyKey) {
    return { authenticated: true, scopes: ['read', 'write'] };
  }

  return { authenticated: false, error: 'Invalid API key' };
}

export function parseActionBody(body: ActionBody) {
  const tool = body.tool || body.action || body.name;
  const reservedKeys = new Set(['tool', 'action', 'name', 'params', 'arguments']);
  const inlineParams = Object.fromEntries(
    Object.entries(body).filter(([key]) => !reservedKeys.has(key))
  );
  const params = body.params || body.arguments || inlineParams;

  return { tool, params };
}

export async function readActionJson(request: NextRequest): Promise<ActionBody | BridgeErrorResponse> {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return { error: 'Request body must be valid JSON', status: 400 };
  }

  try {
    const body = JSON.parse(rawBody);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: 'Request body must be a JSON object', status: 400 };
    }
    return body;
  } catch {
    return { error: 'Request body must be valid JSON', status: 400 };
  }
}

export function isBridgeError(value: unknown): value is BridgeErrorResponse {
  return !!value && typeof value === 'object' && 'error' in value && 'status' in value;
}

export function isPlainRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
