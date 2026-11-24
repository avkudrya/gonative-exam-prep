/** Browser calls to the BFF. Errors come back as safe codes only (see server/bff-routes.ts). */
export type BffResult<T> = {ok: true; status: number; data: T} | {ok: false; status: number; error: string; retryAfter?: number};

export async function bff<T = unknown>(path: string, init: {method?: string; body?: unknown; idempotencyKey?: string} = {}): Promise<BffResult<T>> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  try {
    const response = await fetch(`/api/bff/${path}`, {
      method,
      headers: {
        ...(init.body !== undefined ? {'Content-Type': 'application/json'} : {}),
        ...(init.idempotencyKey ? {'Idempotency-Key': init.idempotencyKey} : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      return {ok: false, status: response.status, error: typeof data.error === 'string' ? data.error : 'unavailable',
        retryAfter: typeof data.retry_after === 'number' ? data.retry_after : undefined};
    }
    return {ok: true, status: response.status, data: data as T};
  } catch {
    return {ok: false, status: 0, error: 'offline'};
  }
}
