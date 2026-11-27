import 'server-only';
import {cookies} from 'next/headers';
import {cache} from 'react';
import {z} from 'zod';
import {readingAttemptSchema, readingIndexSchema, writingSessionSchema, writingSessionsSchema, assessmentSchema, attemptSchema, attemptSummarySchema, catalogSchema, entitlementsSchema, identitySchema, practiceSessionSchema, practiceSkillsSchema, practiceTaskSchema, profileSchema, planSchema, recommendationSchema, reportedResultSchema, skillsSchema} from '../lib/api/schemas';
import {backend, BackendError, cookieName} from './upstream';
import {writingTasks, type WritingTask} from '../lib/writing';

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

/** Deduplicated per request: the layout (Reading link) and the page may both ask. */
export const currentEntitlements = cache(async () => {
  const token = await sessionToken();
  return entitlementsSchema.parse(await backend('entitlements', 'GET', undefined, token ?? undefined));
});

/** Public catalog: exams whose Writing Task 2 can be assessed. The session is not sent. */
/** Exams with an assessable Writing task, and which of their tasks the backend assesses (Task 1 only where it says so). */
export const assessableExams = cache(async () => {
  const catalog = catalogSchema.parse(await backend('catalog', 'GET', undefined, undefined, {maxBytes: 512 * 1024}));
  return catalog.exams
    .map(exam => ({key: exam.exam_key, name: exam.official_name,
      // P5.12: the backend can run a full Writing simulation of this exam.
      simulation: exam.sections.find(s => s.key === 'writing')?.simulation === true,
      tasks: (exam.sections.find(s => s.key === 'writing')?.tasks ?? [])
        .filter(task => task.assessable && (writingTasks as readonly string[]).includes(task.key)).map(task => task.key as WritingTask).sort()}))
    .filter(exam => exam.tasks.includes('task-2'));
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

export async function practiceTasks(exam: string, task: WritingTask = 'task-2') {
  const token = await sessionToken();
  // Task 1 tasks carry their chart data: a larger answer.
  const result = await backend(`tasks?${new URLSearchParams({exam, task})}`, 'GET', undefined, token ?? undefined, {maxBytes: 1024 * 1024}) as {tasks: unknown};
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

export async function attemptsPage(page: number, perPage = 20) {
  const token = await sessionToken();
  const result = await backend(`attempts?page=${page}&per_page=${perPage}`, 'GET', undefined, token ?? undefined, {maxBytes: 256 * 1024}) as Record<string, unknown>;
  return {attempts: attemptSummarySchema.array().parse(result.attempts), page: Number(result.page) || page, perPage, total: Number(result.total) || 0};
}

export async function currentSkills() {
  const token = await sessionToken();
  return skillsSchema.parse(await backend('skills', 'GET', undefined, token ?? undefined, {maxBytes: 256 * 1024}));
}

/** P4.5 and P4.6: the open next steps and this week's plan. */
export async function currentRecommendations() {
  const token = await sessionToken();
  const result = await backend('recommendations', 'GET', undefined, token ?? undefined) as {recommendations: unknown};
  // A step of a kind this site does not know yet is left out instead of hiding every step.
  return z.array(z.unknown()).max(10).parse(result.recommendations)
    .flatMap(step => {
      const parsed = recommendationSchema.safeParse(step);
      return parsed.success ? [parsed.data] : [];
    });
}

/** P4.8: the skills the bank can train now; empty when practice is off or the backend is older. */
export const practiceSkills = cache(async () => {
  const token = await sessionToken();
  try {
    return practiceSkillsSchema.parse(await backend('practice/skills', 'GET', undefined, token ?? undefined)).skills;
  } catch {
    return [];
  }
});

/** One practice session of the signed-in member, or `null` when it does not exist or is not theirs. */
export async function currentPractice(uuid: string) {
  const token = await sessionToken();
  try {
    const result = await backend(`practice/${uuid}`, 'GET', undefined, token ?? undefined, {maxBytes: 256 * 1024}) as {session: unknown};
    return practiceSessionSchema.parse(result.session);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

export async function currentPlan() {
  const token = await sessionToken();
  const result = await backend('plan', 'GET', undefined, token ?? undefined) as {plan: unknown};
  return planSchema.parse(result.plan);
}

export async function currentReportedResults() {
  const token = await sessionToken();
  const result = await backend('reported-results', 'GET', undefined, token ?? undefined) as {reported_results: unknown};
  return reportedResultSchema.array().parse(result.reported_results);
}

/** P5.12: whether simulations are on, the open session and the recent submitted ones. */
export async function writingSessions() {
  const token = await sessionToken();
  return writingSessionsSchema.parse(await backend('writing-sessions', 'GET', undefined, token ?? undefined, {maxBytes: 2 * 1024 * 1024}));
}

/** One Writing simulation of the signed-in member, or `null` when it does not exist or is not theirs. */
export async function writingSession(uuid: string) {
  const token = await sessionToken();
  try {
    const result = await backend(`writing-sessions/${uuid}`, 'GET', undefined, token ?? undefined, {maxBytes: 512 * 1024}) as {session: unknown};
    return writingSessionSchema.parse(result.session);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}

/** P7.4: Reading — whether it is on, the month's count, the tests, the open attempt and the recent ones. */
export async function readingIndex() {
  const token = await sessionToken();
  return readingIndexSchema.parse(await backend('reading', 'GET', undefined, token ?? undefined, {maxBytes: 512 * 1024}));
}

/** One Reading attempt of the signed-in member, or `null` when it does not exist or is not theirs. */
export async function readingAttempt(uuid: string) {
  const token = await sessionToken();
  try {
    const result = await backend(`reading/attempts/${uuid}`, 'GET', undefined, token ?? undefined, {maxBytes: 1024 * 1024}) as {attempt: unknown};
    return readingAttemptSchema.parse(result.attempt);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
