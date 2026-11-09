import 'server-only';
import { NextResponse } from 'next/server';
import {
  DB_UNAVAILABLE_MESSAGE,
  HttpError,
  MissingSecretError,
  NOT_CONFIGURED_MESSAGE,
  isDatabaseUnavailable,
  redactUri,
} from './errors';

// Consistent JSON responses and error handling for every API route (200/201/400/401/404/409/500/503).
// Error bodies hold a short Arabic message (+ optional `fields` codes) — never a stack trace, connection string,
// secret or password hash. Every response is Cache-Control: no-store.

export { HttpError, isDatabaseUnavailable };

export const MESSAGES = {
  badJson: 'البيانات المرسلة مو صحيحة',
  invalid: 'بعض البيانات مو صحيحة',
  server: 'صار خطأ عندنا، جرّب مرة ثانية',
  dbDown: DB_UNAVAILABLE_MESSAGE,
  notConfigured: NOT_CONFIGURED_MESSAGE,
} as const;

export function json(data: unknown, status = 200, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return NextResponse.json(data, { ...init, status, headers });
}

/** `{ error, fields? }` with the given status. */
export function apiError(status: number, error: string, fields?: Record<string, string>): NextResponse {
  return json(fields && Object.keys(fields).length ? { error, fields } : { error }, status);
}

/** Parses a JSON body; anything that is not JSON → HttpError 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, MESSAGES.badJson);
  }
}

function safeLog(error: unknown) {
  const e = error as { name?: string; message?: string } | null;
  console.error(`[api] ${e?.name ?? 'Error'}: ${redactUri(String(e?.message ?? error))}`);
}

/** Maps any thrown error to a safe JSON response (503 when the DB/secrets are unavailable, never a stack trace). */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) return json({ error: error.message, ...(error.details ?? {}) }, error.status);
  if (error instanceof MissingSecretError) {
    console.error(`[api] missing server secret: ${error.key}`);
    return json({ error: MESSAGES.notConfigured }, 503);
  }
  if (isDatabaseUnavailable(error)) {
    safeLog(error);
    return json({ error: MESSAGES.dbDown }, 503);
  }
  const name = (error as { name?: string } | null)?.name;
  if (name === 'ValidationError' || name === 'CastError') return json({ error: MESSAGES.invalid }, 400);
  safeLog(error);
  return json({ error: MESSAGES.server }, 500);
}
