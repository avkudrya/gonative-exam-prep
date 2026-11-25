import 'server-only';

/**
 * The one client of the Exams API (MultiAdmin `api/exam/*`). Server-side only: the session token
 * lives in an httpOnly cookie of this host and never reaches browser JavaScript.
 */
export const cookieName = process.env.NODE_ENV === 'production' ? '__Host-exams' : 'exams-session';

/**
 * Backend error codes that are safe and useful to show. Anything else collapses to a generic
 * status, so exception text, field values and private details are never reflected.
 */
export const safeReasons = new Set([
  // Accounts and sessions
  'invalid_credentials', 'account_exists_sign_in', 'registration_required', 'email_verification_required',
  'account_unavailable', 'exams_profile_required', 'account_not_found', 'invalid_google_identity', 'identity_conflict',
  'verification_unavailable', 'invalid_verification', 'invalid_password_reset', 'password_too_long',
  'invalid_current_password', 'password_unchanged', 'password_change_unavailable', 'reauthentication_required',
  'exams_onboarding_required', 'terms_version_changed', 'exams_unavailable',
  // Attempts and assessment
  'exams_exam_unavailable', 'exams_task_unavailable', 'exams_practice_task_unavailable', 'exams_custom_prompt_invalid',
  'exams_task_mismatch', 'exactly_one_task_source', 'exams_draft_limit', 'exams_revision_conflict',
  'exams_attempt_not_editable', 'exams_attempt_not_submittable', 'exams_attempt_assessing', 'exams_response_empty',
  'exams_response_too_long', 'exams_response_invalid_characters', 'exams_assessment_in_progress',
  'exams_assessment_unavailable', 'exams_assessment_not_active', 'exams_monthly_quota_exhausted',
  'exams_monthly_ai_budget_exhausted', 'exams_concurrency_limit', 'request_key_conflict', 'exams_busy',
  // Reports and results
  'exams_nothing_to_report', 'exams_report_limit', 'exams_unknown_finding', 'exams_reported_results_limit',
  'exams_section_not_on_scale', 'exams_target_not_on_scale',
  // Practice from the bank (P4.8)
  'exams_practice_skill_unavailable', 'exams_practice_unavailable', 'exams_practice_daily_limit', 'exams_practice_closed',
  'exams_answer_invalid', 'exams_answer_required',
  // Limits
  'exams_rate_limited', 'exams_requests_rate_limited',
]);

export class BackendError extends Error {
  constructor(public status: number, public reason?: string, public retryAfter?: number) {
    super('Backend request failed');
  }
}

async function bounded(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new BackendError(502);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new BackendError(502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Reads `{error: {code, retry_after?, fields?}}`; field-level codes are more specific than `validation_failed`. */
async function failure(response: Response) {
  let reason: string | undefined;
  let retryAfter: number | undefined;
  try {
    const body = JSON.parse(await bounded(response, 16384)) as {error?: {code?: unknown; retry_after?: unknown; fields?: Record<string, unknown>}};
    const codes = [...Object.values(body.error?.fields ?? {}).flat(), body.error?.code];
    reason = codes.find((code): code is string => typeof code === 'string' && safeReasons.has(code));
    const after = body.error?.retry_after;
    if (typeof after === 'number' && Number.isInteger(after) && after > 0) retryAfter = Math.min(after, 86400 * 31);
  } catch {
    // Unparseable or oversized error bodies are never reflected.
  }
  return new BackendError(response.status, reason, retryAfter);
}

/** The one trusted upstream: HTTPS, or plain HTTP only on loopback for local development. */
export function apiBase() {
  const configured = process.env.EXAMS_API_URL;
  if (!configured) throw new BackendError(503);
  const base = new URL(configured);
  const loopback = base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !loopback)) throw new BackendError(503);
  return base;
}

export type BackendOptions = {maxBytes?: number; timeoutMs?: number; headers?: Record<string, string>};

export async function backend(path: string, method = 'GET', data?: unknown, token?: string, options: BackendOptions = {}) {
  const base = apiBase();
  try {
    const response = await fetch(`${base.href.replace(/\/$/, '')}/${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(data === undefined ? {} : {'Content-Type': 'application/json'}),
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
        ...options.headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    });
    if (!response.ok) throw await failure(response);
    if (response.status === 204) return null;
    return JSON.parse(await bounded(response, options.maxBytes ?? 65536)) as unknown;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError(502);
  }
}
