/**
 * Browser-side API helpers for authenticated staff UI.
 * Centralizes 401 → login redirect and JSON error parsing.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body ?? null;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) return err;
  }
  return fallback;
}

/**
 * fetch() wrapper for JSON APIs. Throws UnauthorizedError on 401,
 * ApiError on other non-OK responses.
 */
export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      messageFromBody(body, `Request failed (${response.status})`),
      response.status,
      body
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('Invalid JSON response', response.status, text);
  }
}

export function loginPath(next = '/claims'): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** True when the error should send the user to the login page. */
export function isUnauthorized(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}
