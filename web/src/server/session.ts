import 'server-only';
import {cookies} from 'next/headers';
import {cache} from 'react';
import {assessmentSchema, attemptSchema, attemptSummarySchema, catalogSchema, entitlementsSchema, identitySchema, practiceTaskSchema, profileSchema} from '../lib/api/schemas';
import {backend, BackendError, cookieName} from './upstream';

/** Server components read the session from the httpOnly cookie; `null` means "not signed in". */
export async function sessionToken() {
  return (await cookies()).get(cookieName)?.value ?? null;
}

/** Deduplicated per request: the layout and the page both ask. */
export const currentIdentity = cache(async () => {
  const token = await sessionToken();
  if (!token) return null;
  try {
    return identitySchema.parse(await backend('auth/me', 'GET', undefined, token));
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) return null;
    throw error;
  }
});

export async function currentProfile() {
  const token = await sessionToken();
  const result = await backend('profile', 'GET', undefined, token ?? undefined) as {profile: unknown};
  return profileSchema.parse(result.profile);
}

export async function currentEntitlements() {
  const token = await sessionToken();
  return entitlementsSchema.parse(await backend('entitlements', 'GET', undefined, token ?? undefined));
}

/** Public catalog: exams whose Writing Task 2 can be assessed. The session is not sent. */
export const assessableExams = cache(async () => {
  const catalog = catalogSchema.parse(await backend('catalog', 'GET', undefined, undefined, {maxBytes: 512 * 1024}));
  return catalog.exams
    .filter(exam => exam.sections.some(s => s.key === 'writing' && s.tasks.some(task => task.key === 'task-2' && task.assessable)))
    .map(exam => ({key: exam.exam_key, name: exam.official_name}));
});

/** One attempt of the signed-in member, or `null` when it does not exist or is not theirs. */
export async function currentAttempt(uuid: string) {
  const token = await sessionToken();
  try {
    const result = await backend(`attempts/${uuid}`, 'GET', undefined, token ?? undefined, {maxBytes: 256 * 1024}) as {attempt: unknown};
    return attemptSchema.parse(result.attempt);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

export async function recentAttempts(perPage = 5) {
  const token = await sessionToken();
  const result = await backend(`attempts?per_page=${perPage}`, 'GET', undefined, token ?? undefined, {maxBytes: 256 * 1024}) as {attempts: unknown; total: unknown};
  return {attempts: attemptSummarySchema.array().parse(result.attempts), total: Number(result.total) || 0};
}

export async function practiceTasks(exam: string) {
  const token = await sessionToken();
  const result = await backend(`tasks?${new URLSearchParams({exam})}`, 'GET', undefined, token ?? undefined, {maxBytes: 256 * 1024}) as {tasks: unknown};
  return practiceTaskSchema.array().parse(result.tasks);
}

/** The current assessment of an attempt, or `null` before one exists. */
export async function currentAssessment(uuid: string) {
  const token = await sessionToken();
  try {
    const result = await backend(`attempts/${uuid}/assessment`, 'GET', undefined, token ?? undefined, {maxBytes: 512 * 1024}) as {assessment: unknown};
    return assessmentSchema.parse(result.assessment);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
