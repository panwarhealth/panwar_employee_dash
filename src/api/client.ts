/**
 * Tiny fetch wrapper used by every API call in the app.
 *
 * - Always sends the session cookie (`credentials: 'include'`) so the API's
 *   AuthenticationMiddleware can read it.
 * - Throws ApiError with the parsed JSON error body on non-2xx responses
 *   so callers don't have to repeat error handling.
 * - JavaScript never touches the JWT — it lives in the HttpOnly cookie set
 *   on `.panwarhealth.com.au` after the Entra SSO exchange.
 */

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:7071/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = {};
  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: serializedBody,
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // Ignore — some error responses are empty
    }
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, parsed, message);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
