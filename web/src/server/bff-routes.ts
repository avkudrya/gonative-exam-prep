import 'server-only';
import {z} from 'zod';
import {
  assessmentSchema, attemptSchema, attemptSummarySchema, catalogSchema, comparisonSchema, entitlementsSchema, rewriteCheckSchema,
  feedbackLanguageSchema, identitySchema, interfaceLocaleSchema, practiceTaskSchema, profileSchema, reportKinds,
  practiceAnswerSchema, practiceResultSchema, practiceSessionSchema, practiceSkillsSchema,
  recommendationSchema, reportSchema, reportedResultSchema, skillsSchema, vocabularyListSchema, vocabularySchema,
  writingSessionSchema, writingSessionsSchema, readingAttemptSchema, readingIndexSchema,
} from '../lib/api/schemas';

/*
 * Exact allowlist of the BFF: every reachable upstream path, method, input, credential and output
 * projection is listed here. Anything else is 404 before the backend is called.
 */

export type Output = {data: unknown; status?: number};
export type Route = {
  upstream: string;
  /** Validates and shapes the JSON body of a write; GET and DELETE without a body have none. */
  input?: z.ZodType;
  authenticated: boolean;
  /** Mutations that the backend fences by `Idempotency-Key`. */
  requestKey?: boolean;
  /** Response size limit from the backend (bytes). */
  maxBytes?: number;
  /** Request body limit (bytes). */
  maxBody?: number;
  timeoutMs?: number;
  output: (result: unknown) => Output;
};

export const requestKeyPattern = /^[a-zA-Z0-9_-]{8,64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

const email = z.string().trim().email().max(255);
const anyPassword = z.string().min(1).max(255);
// Backend limit: 10–72 characters and at most 72 bytes (bcrypt).
const newPassword = z.string().min(10).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72);
const proof = z.string().regex(/^[a-zA-Z0-9]{64}$/);
const locale = interfaceLocaleSchema;
const empty = z.object({}).strict();
const examKey = z.string().max(64).regex(keyPattern);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sections = z.record(z.string().max(64).regex(keyPattern), z.number().min(0).max(1000))
  .refine(v => Object.keys(v).length >= 1 && Object.keys(v).length <= 8);
/** The backend counts code points of the normalized text (max 20 000); JSON may escape each one. */
const DRAFT_BODY = 200 * 1024;

const authInputs: Record<string, z.ZodType> = {
  'auth/login': z.object({email, password: anyPassword}).strict(),
  'auth/join': z.object({email, password: anyPassword, locale}).strict(),
  'auth/register': z.object({email, password: newPassword, password_confirmation: z.string().max(72), locale}).strict()
    .refine(v => v.password === v.password_confirmation)
    .transform(({email, password, locale}) => ({email, password, locale})),
  'auth/google': z.object({id_token: z.string().min(1).max(8192), create_account: z.boolean(), locale}).strict(),
  'auth/activate': z.object({token: proof}).strict(),
  'auth/resend': z.object({email, password: anyPassword}).strict(),
  'auth/forgot': z.object({email}).strict(),
  'auth/reset': z.object({token: proof, password: newPassword, password_confirmation: z.string().max(72)}).strict()
    .refine(v => v.password === v.password_confirmation),
  'auth/password': z.object({current_password: anyPassword, password: newPassword, password_confirmation: z.string().max(72)}).strict()
    .refine(v => v.password === v.password_confirmation),
  'auth/logout': empty,
};
/** Auth confirmations never reflect upstream fields: only the fixed status. */
const confirmations: Record<string, {status: string; code: number}> = {
  'auth/register': {status: 'verification_required', code: 202},
  'auth/activate': {status: 'verified', code: 200},
  'auth/resend': {status: 'verification_requested', code: 202},
  'auth/forgot': {status: 'reset_requested', code: 202},
  'auth/reset': {status: 'password_reset', code: 200},
};
export const sessionPaths = new Set(['auth/login', 'auth/join', 'auth/google']);

const profileInput = z.object({
  interface_locale: locale.optional(),
  target_exam_key: examKey.nullable().optional(),
  target_result: sections.nullable().optional(),
  exam_date: date.nullable().optional(),
  weekly_minutes: z.int().min(0).max(3000).nullable().optional(),
  feedback_language: feedbackLanguageSchema.optional(),
  translation_language: z.enum(['ru', 'uk']).nullable().optional(),
  confirm_age_16: z.literal(true).optional(),
  accept_terms: z.literal(true).optional(),
  terms_version: z.string().max(32).optional(),
}).strict().refine(v => Object.keys(v).some(k => k !== 'terms_version'));

const attemptInput = z.object({
  exam_key: examKey,
  section_key: examKey.optional(),
  task_key: examKey.optional(),
  practice_task: z.string().regex(uuidPattern).optional(),
  custom_prompt: z.string().trim().min(1).max(2000).optional(),
  from_attempt: z.string().regex(uuidPattern).optional(),
}).strict().refine(v => [v.practice_task, v.custom_prompt, v.from_attempt].filter(x => x !== undefined).length === 1);

const draftInput = z.object({
  expected_revision: z.int().min(0).max(2147483647),
  response_text: z.string().max(40000),
}).strict();

const reportInput = z.object({
  kind: z.enum(reportKinds),
  finding_id: z.string().min(1).max(64).optional(),
  message: z.string().max(1000).optional(),
  allow_text_access: z.boolean().optional(),
}).strict();

const vocabularyInput = z.object({dictionary_ids: z.array(z.int().positive()).min(1).max(15).nullable()}).strict();
// P4.14: one rewritten sentence of «Fix it yourself»; the backend checks it with AI and stores nothing.
const rewriteInput = z.object({finding_id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), text: z.string().min(1).max(400)}).strict();

const reportedInput = z.object({
  exam_key: examKey,
  test_date: date,
  sections,
  calibration_consent: z.boolean().optional(),
}).strict();
const reportedUpdate = reportedInput.omit({exam_key: true}).partial().strict()
  .refine(v => Object.keys(v).length > 0);

const parse = <T extends z.ZodType>(schema: T) => (r: unknown): Output => ({data: schema.parse(r)});
const deleted = (): Output => ({data: {status: 'deleted'}});
const route = (upstream: string, output: Route['output'], extra: Partial<Route> = {}): Route =>
  ({upstream, output, authenticated: true, ...extra});

function noQuery(search: URLSearchParams) {
  return search.size === 0;
}

/** Only `page` and `per_page`, each once, as positive integers. */
function pageQuery(search: URLSearchParams) {
  if (new Set(search.keys()).size !== search.size) return null;
  const query = z.object({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    per_page: z.coerce.number().int().min(1).max(50).optional(),
  }).strict().safeParse(Object.fromEntries(search));
  if (!query.success) return null;
  const upstream = new URLSearchParams(Object.entries(query.data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  return upstream.toString() ? `?${upstream}` : '';
}

export function resolve(path: string, method: string, search: URLSearchParams): Route | null {
  if (method === 'POST' && path in authInputs && noQuery(search)) {
    const confirmation = confirmations[path];
    return {
      upstream: path,
      input: authInputs[path],
      authenticated: path === 'auth/logout' || path === 'auth/password',
      output: result => confirmation ? {data: {status: confirmation.status}, status: confirmation.code} : {data: result},
    };
  }
  if (path === 'auth/me' && method === 'GET' && noQuery(search)) return route(path, parse(identitySchema));
  if (path === 'account' && method === 'DELETE' && noQuery(search)) {
    return route(path, () => ({data: {status: 'account_closed'}, status: 202}), {
      input: z.object({confirm: z.literal('all_products'), password: anyPassword.optional(), google_id_token: z.string().min(1).max(8192).optional()})
        .strict().refine(v => (v.password === undefined) !== (v.google_id_token === undefined)),
    });
  }
  if (path === 'data' && method === 'DELETE' && noQuery(search)) {
    return route(path, () => ({data: {status: 'exams_data_deleted'}}), {
      input: z.object({confirm: z.literal('exams'), password: anyPassword}).strict(),
      timeoutMs: 30000,
    });
  }
  if (path === 'profile' && noQuery(search)) {
    const output = (r: unknown) => ({data: {profile: profileSchema.parse((r as {profile: unknown}).profile)}});
    if (method === 'GET') return route(path, output);
    if (method === 'PUT') return route(path, output, {input: profileInput});
  }
  if (path === 'entitlements' && method === 'GET' && noQuery(search)) return route(path, parse(entitlementsSchema));
  // Public catalog: the session is never forwarded.
  if (path === 'catalog' && method === 'GET' && noQuery(search)) {
    return {upstream: path, authenticated: false, maxBytes: 512 * 1024, output: parse(catalogSchema)};
  }
  if (path === 'tasks' && method === 'GET') {
    if (new Set(search.keys()).size !== search.size) return null;
    const query = z.object({exam: examKey, section: examKey.optional(), task: examKey.optional()}).strict()
      .safeParse(Object.fromEntries(search));
    if (!query.success) return null;
    const upstream = new URLSearchParams(Object.entries(query.data).filter(([, v]) => v !== undefined) as [string, string][]);
    return route(`tasks?${upstream}`, parse(z.object({tasks: z.array(practiceTaskSchema)})), {maxBytes: 256 * 1024});
  }
  const task = /^tasks\/([^/]+)$/.exec(path);
  if (task && uuidPattern.test(task[1]) && method === 'GET' && noQuery(search)) {
    return route(`tasks/${task[1].toLowerCase()}`, parse(z.object({task: practiceTaskSchema})));
  }
  if (path === 'attempts') {
    if (method === 'GET') {
      const query = pageQuery(search);
      if (query === null) return null;
      return route(`attempts${query}`, parse(z.object({
        attempts: z.array(attemptSummarySchema), page: z.int(), per_page: z.int(), total: z.int(),
      })), {maxBytes: 256 * 1024});
    }
    if (method === 'POST' && noQuery(search)) {
      return route(path, r => ({data: z.object({attempt: attemptSchema}).parse(r), status: 201}), {input: attemptInput, maxBody: 8192, maxBytes: 256 * 1024});
    }
    return null;
  }
  if (path === 'skills' && method === 'GET' && noQuery(search)) return route(path, parse(skillsSchema), {maxBytes: 256 * 1024});
  if (path === 'reported-results' && noQuery(search)) {
    if (method === 'GET') return route(path, parse(z.object({reported_results: z.array(reportedResultSchema)})));
    if (method === 'POST') return route(path, r => ({data: z.object({reported_result: reportedResultSchema}).parse(r), status: 201}), {input: reportedInput});
    return null;
  }
  // P4.8: practice from the Edu bank, one question at a time; keys stay on the backend until a question is answered.
  if (path === 'practice/skills' && method === 'GET' && noQuery(search)) return route(path, parse(practiceSkillsSchema));
  const linkedPractice = /^attempts\/([^/]+)\/grammar-practice$/.exec(path);
  if (linkedPractice && uuidPattern.test(linkedPractice[1]) && method === 'GET' && noQuery(search)) {
    return route(path, parse(z.object({results: z.array(z.object({
      size: z.number().int().min(5).max(20), answered: z.number().int().min(0).max(20), percent: z.number().min(0).max(100).nullable(),
    })).max(20)})));
  }
  if (path === 'practice' && method === 'POST' && noQuery(search)) {
    return route(path, r => ({data: z.union([
      z.object({session: practiceSessionSchema}),
      z.object({grammar_practice: z.object({reference: z.string().regex(uuidPattern).nullable()})}),
    ]).parse(r)}), {
      input: z.object({skill_key: z.string().max(96).regex(/^[a-z]+\.[a-z_]+$/), attempt_uuid: z.string().regex(uuidPattern).optional(), recommendation_uuid: z.string().regex(uuidPattern).optional()}).strict(),
      maxBytes: 256 * 1024,
    });
  }
  const practice = /^practice\/([^/]+)(?:\/(finish|answers\/([0-9a-f]{24})))?$/.exec(path);
  if (practice && uuidPattern.test(practice[1]) && noQuery(search)) {
    const root = `practice/${practice[1].toLowerCase()}`;
    const session = parse(z.object({session: practiceSessionSchema}));
    if (!practice[2] && method === 'GET') return route(root, session, {maxBytes: 256 * 1024});
    if (practice[2] === 'finish' && method === 'POST') return route(`${root}/finish`, session, {input: empty, maxBytes: 256 * 1024});
    if (practice[3] && method === 'POST') {
      return route(`${root}/answers/${practice[3]}`, parse(z.object({result: practiceResultSchema})), {input: z.object({answer: practiceAnswerSchema}).strict(), maxBody: 16 * 1024});
    }
    return null;
  }
  // P5.12: full Writing simulation. Drafts go through attempts/{uuid}/draft; the submit sends both answers once.
  if (path === 'writing-sessions' && noQuery(search)) {
    if (method === 'GET') return route(path, parse(writingSessionsSchema), {maxBytes: 2 * 1024 * 1024});
    if (method === 'POST') {
      return route(path, r => ({data: z.object({session: writingSessionSchema}).parse(r), status: 201}),
        {input: z.object({exam_key: examKey}).strict(), maxBytes: 512 * 1024});
    }
    return null;
  }
  const simulation = /^writing-sessions\/([^/]+)(?:\/(swap|start|abandon|submit))?$/.exec(path);
  if (simulation && uuidPattern.test(simulation[1]) && noQuery(search)) {
    const root = `writing-sessions/${simulation[1].toLowerCase()}`;
    const one = parse(z.object({session: writingSessionSchema}));
    if (!simulation[2]) return method === 'GET' ? route(root, one, {maxBytes: 512 * 1024}) : null;
    if (method !== 'POST') return null;
    if (simulation[2] === 'start') return route(`${root}/start`, one, {input: z.object({timer_mode: z.enum(['soft', 'strict'])}).strict(), maxBytes: 512 * 1024});
    if (simulation[2] === 'submit') {
      return route(`${root}/submit`, r => ({data: z.object({session: writingSessionSchema}).parse(r), status: 202}),
        {input: empty, requestKey: true, maxBytes: 512 * 1024, timeoutMs: 20000});
    }
    return route(`${root}/${simulation[2]}`, one, {input: empty, maxBytes: 512 * 1024});
  }
  // P7.4: IELTS Reading. Answers are question number → text (at most 40, 200 characters each); marking is by key on the backend.
  if (path === 'reading' && method === 'GET' && noQuery(search)) return route(path, parse(readingIndexSchema), {maxBytes: 512 * 1024});
  if (path === 'reading/attempts' && method === 'POST' && noQuery(search)) {
    return route(path, r => ({data: z.object({attempt: readingAttemptSchema}).parse(r), status: 201}), {
      input: z.object({test: z.string().regex(uuidPattern), mode: z.enum(['test', 'section']), section: z.int().min(1).max(3).optional(),
        timer_mode: z.enum(['soft', 'strict'])}).strict(),
      maxBytes: 1024 * 1024,
    });
  }
  const reading = /^reading\/attempts\/([^/]+)(?:\/(answers|submit|abandon))?$/.exec(path);
  if (reading && uuidPattern.test(reading[1]) && noQuery(search)) {
    const root = `reading/attempts/${reading[1].toLowerCase()}`;
    const one = parse(z.object({attempt: readingAttemptSchema}));
    const answers = z.record(z.string().regex(/^\d{1,2}$/), z.string().max(200).nullable()).refine(v => Object.keys(v).length <= 40);
    if (!reading[2]) return method === 'GET' ? route(root, one, {maxBytes: 1024 * 1024}) : null;
    if (reading[2] === 'answers' && method === 'PUT') {
      return route(`${root}/answers`, parse(z.object({revision: z.int().min(0), server_time: z.string().max(64)})), {input: z.object({answers}).strict(), maxBody: 32 * 1024});
    }
    if (method !== 'POST') return null;
    if (reading[2] === 'submit') return route(`${root}/submit`, one, {input: z.object({answers: answers.optional()}).strict(), maxBody: 32 * 1024, maxBytes: 1024 * 1024, timeoutMs: 20000});
    return route(`${root}/abandon`, one, {input: empty, maxBytes: 1024 * 1024});
  }
  // P4.5: the learner marks a next step done or hides it.
  const step = /^recommendations\/([^/]+)\/(done|dismiss)$/.exec(path);
  if (step && uuidPattern.test(step[1]) && method === 'POST' && noQuery(search)) {
    return route(`recommendations/${step[1].toLowerCase()}/${step[2]}`, parse(z.object({recommendation: recommendationSchema})), {input: empty});
  }
  const reported = /^reported-results\/([^/]+)(\/comparison)?$/.exec(path);
  if (reported && uuidPattern.test(reported[1]) && noQuery(search)) {
    const root = `reported-results/${reported[1].toLowerCase()}`;
    if (reported[2]) return method === 'GET' ? route(`${root}/comparison`, parse(comparisonSchema), {maxBytes: 256 * 1024}) : null;
    if (method === 'PUT') return route(root, parse(z.object({reported_result: reportedResultSchema})), {input: reportedUpdate});
    if (method === 'DELETE') return route(root, deleted);
    return null;
  }
  const attempt = /^attempts\/([^/]+)(?:\/(draft|submit|assessment|reports|vocabulary|vocabulary\/list|rewrite-check))?$/.exec(path);
  if (!attempt || !uuidPattern.test(attempt[1]) || !noQuery(search)) return null;
  const root = `attempts/${attempt[1].toLowerCase()}`;
  const action = attempt[2];
  if (!action && method === 'GET') return route(root, parse(z.object({attempt: attemptSchema})), {maxBytes: 256 * 1024});
  if (!action && method === 'DELETE') return route(root, deleted);
  if (action === 'draft' && method === 'PUT') {
    return route(`${root}/draft`, parse(z.object({attempt: attemptSummarySchema})), {input: draftInput, maxBody: DRAFT_BODY});
  }
  if (action === 'submit' && method === 'POST') {
    // 202: a new assessment is queued; 200: the same text was assessed before and its result is reused.
    return route(`${root}/submit`, r => {
      const data = z.object({attempt: attemptSummarySchema, assessment: assessmentSchema, reused: z.boolean()}).parse(r);
      return {data, status: data.reused ? 200 : 202};
    }, {input: empty, requestKey: true, maxBytes: 512 * 1024, timeoutMs: 20000});
  }
  if (action === 'assessment' && method === 'GET') return route(`${root}/assessment`, parse(z.object({assessment: assessmentSchema})), {maxBytes: 512 * 1024});
  if (action === 'reports' && method === 'GET') return route(`${root}/reports`, parse(z.object({reports: z.array(reportSchema)})));
  if (action === 'reports' && method === 'POST') {
    return route(`${root}/reports`, r => ({data: z.object({report: reportSchema}).parse(r), status: 201}), {input: reportInput});
  }
  // P4.4: words from the feedback into a GoNative list. The backend creates the list once and returns it after that;
  // `list: null` means the free GoNative quota had no room.
  if (action === 'vocabulary' && method === 'GET') return route(`${root}/vocabulary`, parse(vocabularySchema));
  if (action === 'vocabulary/list' && method === 'POST') return route(`${root}/vocabulary/list`, parse(vocabularyListSchema), {input: vocabularyInput});
  if (action === 'rewrite-check' && method === 'POST') return route(`${root}/rewrite-check`, parse(rewriteCheckSchema), {input: rewriteInput, timeoutMs: 30000});
  return null;
}
