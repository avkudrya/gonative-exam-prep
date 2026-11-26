import {z} from 'zod';

/*
 * Projections of the Exams API (MultiAdmin `ExamPresenter`) as the browser receives them from the BFF.
 * zod objects drop unknown keys, so a field the backend adds later never reaches the client until it
 * is listed here. Scores arrive already presented (ADR-003): the web only shows them, never computes them.
 */

const iso = z.string().max(64);
const isoOrNull = iso.nullable();
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const key = z.string().max(64);

export const interfaceLocaleSchema = z.enum(['en', 'ru', 'uk']);
export const feedbackLanguageSchema = z.enum(['en', 'ru', 'uk']);
export const feedbackLanguages = feedbackLanguageSchema.options;
export type FeedbackLanguage = z.infer<typeof feedbackLanguageSchema>;

export const identitySchema = z.object({
  user: z.object({email: z.string().max(255), name: z.string().max(255).nullable(), has_password: z.boolean()}),
  account_state: z.enum(['active', 'cleanup_pending']),
});

export const profileSchema = z.object({
  interface_locale: interfaceLocaleSchema.nullable(),
  target_exam_key: key.nullable(),
  target_result: z.record(z.string(), z.number()).nullable(),
  exam_date: z.string().max(10).nullable(),
  weekly_minutes: z.int().nullable(),
  feedback_language: feedbackLanguageSchema.nullable(),
  translation_language: z.enum(['ru', 'uk']).nullable(),
  age_confirmed: z.boolean(),
  terms_accepted: z.boolean(),
  terms_version: z.string().max(32),
  onboarding_complete: z.boolean(),
});

export const entitlementsSchema = z.object({
  plan: z.string().max(64),
  period: z.object({start: z.string().max(10), end: z.string().max(10)}),
  assessments: z.object({limit: z.int(), used: z.int(), pending: z.int(), remaining: z.int()}),
  concurrent: z.int(),
  // P4.14: AI checks in «Fix it yourself»; absent from an older backend.
  rewrite_checks: z.object({enabled: z.boolean(), limit: z.int(), used: z.int(), remaining: z.int()}).optional(),
});

/** P4.14: the AI check of one rewritten sentence (the backend stores nothing). */
export const rewriteCheckSchema = z.object({check: z.object({
  verdict: z.enum(['correct', 'error_remains', 'new_error']),
  explanation: z.string().max(400),
  new_error_quote: z.string().max(200).nullable(),
  checks: z.object({limit: z.int(), used: z.int(), remaining: z.int()}),
})});

const scaleSchema = z.object({
  kind: z.string().max(32),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  approximate: z.object({step: z.number(), minWidth: z.number()}).optional(),
});

export const catalogSchema = z.object({
  exams: z.array(z.object({
    exam_key: key,
    provider_key: key,
    official_name: z.string().max(200),
    learning_language: z.string().max(16),
    version: z.string().max(32),
    sections: z.array(z.object({
      key,
      official_name: z.string().max(200).nullable(),
      tasks: z.array(z.object({
        key,
        official_name: z.string().max(200).nullable(),
        time_minutes: z.int().nullable(),
        min_words: z.int().nullable(),
        assessable: z.boolean(),
        criteria: z.array(z.object({key, official_name: z.string().max(200).nullable(), scale: scaleSchema})),
      })),
    })),
  })),
});

export const taskTypes = ['opinion', 'discussion', 'advantages', 'problem_solution', 'two_part'] as const;

export const practiceTaskSchema = z.object({
  uuid,
  topic: z.string().max(200),
  task_type: z.string().max(32),
  difficulty: z.string().max(32).nullable(),
  prompt: z.object({text: z.string().max(4000)}),
  official: z.literal(false),
});

export const assessmentStatuses = ['queued', 'running', 'assessed', 'partial', 'failed', 'canceled'] as const;
export const attemptStatuses = ['draft', 'submitted', 'assessing', 'assessed', 'partial', 'failed'] as const;

export const attemptSummarySchema = z.object({
  uuid,
  exam_key: key,
  exam_version: z.string().max(32),
  section_key: key,
  task_key: key,
  source: z.enum(['library', 'custom']),
  topic: z.string().max(200).nullable(),
  status: z.enum(attemptStatuses),
  revision: z.int().nonnegative(),
  word_count: z.int().nonnegative().nullable(),
  word_count_rule: z.string().max(64).nullable(),
  submitted_at: isoOrNull,
  created_at: isoOrNull,
  updated_at: isoOrNull,
  assessment: z.object({uuid, status: z.enum(assessmentStatuses)}).nullable(),
});

export const attemptSchema = attemptSummarySchema.extend({
  prompt: z.object({text: z.string().max(4000)}),
  response_text: z.string().max(40000),
  assessments: z.array(z.object({uuid, status: z.enum(assessmentStatuses), created_at: isoOrNull})),
});

export const presentedEstimateSchema = z.object({
  precision: z.enum(['approximate', 'calibrated']),
  low: z.number(),
  high: z.number(),
});

export const resultFindingSchema = z.object({
  id: z.string().max(64),
  kind: z.enum(['error', 'weakness', 'suggestion', 'strength']),
  skill: z.string().max(80),
  criterion_key: key.optional(),
  /** The same error was also reported under these criteria; the backend shows it once (FindingCuration). */
  also_criteria: z.array(key).max(4).optional(),
  /** Findings sharing a pattern are one repeated mistake in several places. */
  pattern: z.string().max(80).optional(),
  severity: z.enum(['minor', 'moderate', 'major']),
  span: z.object({start: z.int().nonnegative(), end: z.int().positive()}).optional(),
  quote: z.string().max(2000).optional(),
  suggestion: z.string().max(2000).optional(),
  explanation: z.string().max(4000),
});

export const assessmentResultSchema = z.object({
  status: z.enum(['complete', 'partial', 'failed']).nullable(),
  calibration: z.enum(['uncalibrated', 'calibrated']),
  word_count: z.int().nonnegative().nullable(),
  criteria: z.array(z.object({
    criterion_key: key,
    estimate: presentedEstimateSchema.nullable(),
    confidence: z.enum(['low', 'medium', 'high']).nullable(),
    summary: z.string().max(4000).nullable(),
    finding_ids: z.array(z.string().max(64)),
  })),
  findings: z.array(resultFindingSchema),
  top_fixes: z.array(z.string().max(64)),
  /** The same priorities grouped by skill: examples (finding ids) and the number of places (FindingCuration::topSkills). */
  top_skills: z.array(z.object({
    skill: z.string().max(80),
    finding_ids: z.array(z.string().max(64)).max(10),
    places: z.int().positive(),
  })).max(10).optional(),
});

export const assessmentSchema = z.object({
  uuid,
  status: z.enum(assessmentStatuses),
  feedback_language: z.string().max(16),
  created_at: isoOrNull,
  finished_at: isoOrNull,
  result: assessmentResultSchema.nullable(),
});

export const reportKinds = ['wrong_finding', 'missing_error', 'wrong_score', 'unclear_explanation', 'other'] as const;

export const reportSchema = z.object({
  uuid,
  kind: z.enum(reportKinds),
  finding_id: z.string().max(64).nullable(),
  status: z.string().max(32),
  text_access_allowed: z.boolean(),
  created_at: isoOrNull,
});

/** P4.4: GoNative's learning words quota; limit and remaining are null without a limit (Premium or Exams access). */
export const learningQuotaSchema = z.object({
  tier: z.enum(['free', 'premium', 'exams']),
  limit: z.int().nonnegative().nullable(),
  remaining: z.int().nonnegative().nullable(),
});

export const learningListSchema = z.object({
  lesson_id: z.int().positive(),
  name: z.string().max(120),
  words: z.int().nonnegative(),
  url: z.string().url().max(300).refine(v => v.startsWith('https://')),
});

export const vocabularySchema = z.object({
  words: z.array(z.object({
    dictionary_id: z.int().positive(),
    word: z.string().max(191),
    translation: z.string().max(512).nullable(),
    skill: z.string().max(80),
    finding_id: z.string().max(64),
    level: z.string().max(4).nullable(),
  })).max(15),
  list: learningListSchema.nullable(),
  quota: learningQuotaSchema,
});

export const vocabularyListSchema = z.object({list: learningListSchema.nullable(), quota: learningQuotaSchema});

/** P4.5: a next step from the learner's own feedback; it points to their attempt or a library task, never to essay text. */
export const recommendationKinds = ['rewrite', 'vocabulary_list', 'new_essay', 'reassess', 'practice'] as const;
export const recommendationSchema = z.object({
  uuid,
  kind: z.enum(recommendationKinds),
  status: z.enum(['open', 'done', 'dismissed', 'expired']),
  skill: z.string().max(96).nullable(),
  attempt: uuid.nullable(),
  practice_task: z.object({uuid, topic: z.string().max(191).nullable()}).nullable(),
  finding_ids: z.array(z.string().max(64)).max(10),
  words: z.int().nonnegative().nullable(),
  created_at: isoOrNull,
});

/** P4.6: the week by code; it promises no dates or bands. */
export const planSchema = z.object({
  version: z.int().positive(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks_to_exam: z.int().positive().nullable(),
  essays: z.int().positive().max(7),
  timed: z.boolean(),
  reassess_every_weeks: z.int().positive().max(8),
  daily_words: z.boolean(),
  focus_skills: z.array(z.string().max(96)).max(5),
  // P4.8: short bank practice sessions; an older backend sends none.
  practice_skills: z.array(z.string().max(96)).max(5).default([]),
  practice_sessions: z.int().min(0).max(7).default(0),
  practice_minutes: z.int().min(0).max(120).default(10),
});

const criteriaRanges = z.array(z.object({criterion_key: key, estimate: presentedEstimateSchema.nullable()}));

export const skillsSchema = z.object({
  skills: z.array(z.object({
    skill_key: z.string().max(80),
    status: z.string().max(32),
    per_100_words: z.number(),
    trend: z.string().max(32).nullable(),
    confidence: z.string().max(32).nullable(),
    observations: z.int().nonnegative(),
    // P4.8: the share of correct practice answers in the last 30 days, next to the essay's rate.
    practice: z.object({answered: z.int().nonnegative(), correct: z.int().nonnegative(), percent: z.number().min(0).max(100), last_at: iso}).nullable().default(null),
  })),
  criteria_trend: z.array(z.object({assessment: uuid, finished_at: isoOrNull, criteria: criteriaRanges})),
});

export const reportedResultSchema = z.object({
  uuid,
  exam_key: key,
  exam_version: z.string().max(32),
  test_date: z.string().max(10),
  source: z.literal('self_reported'),
  sections: z.record(z.string(), z.number()),
  calibration_consent: z.boolean(),
  consent_changed_at: isoOrNull,
});

export const comparisonSchema = z.object({
  reported_result: reportedResultSchema,
  window_days: z.int().positive(),
  assessments: z.array(z.object({assessment: uuid, finished_at: isoOrNull, criteria: criteriaRanges})),
});

/*
 * P4.8: practice from the Edu bank. Questions arrive without keys (opaque ids from the backend compiler); a result
 * appears only after the learner answered, with the correct answer and the explanation from the checked bank.
 */
const opaqueId = z.string().regex(/^[0-9a-f]{24}$/);
const shortText = z.string().max(2000);
export const practiceTypes = ['multiple_choice', 'gap_choice', 'gap_fill', 'ordering'] as const;
const practiceOption = z.object({id: opaqueId, text: z.string().max(500)});
export const practiceQuestionSchema = z.object({
  id: opaqueId,
  type: z.enum(practiceTypes),
  text: shortText,
  targets: z.array(z.object({id: opaqueId, label: z.string().max(40), hint: z.string().max(200).nullable().optional(), options: z.array(practiceOption).max(8).optional()})).max(12),
  options: z.array(practiceOption).max(8),
  tokens: z.array(practiceOption).max(40),
  multi_select: z.boolean().optional(),
});
/** One answer: chosen options (multiple choice), each gap's option id or text, or the tokens in order. */
export const practiceAnswerSchema = z.union([
  z.object({selected: z.array(opaqueId).min(1).max(8)}).strict(),
  z.object({gaps: z.record(opaqueId, z.string().max(600)).refine(v => Object.keys(v).length >= 1 && Object.keys(v).length <= 12)}).strict(),
  z.object({tokens: z.array(opaqueId).min(1).max(40)}).strict(),
]);
export type PracticeAnswer = z.infer<typeof practiceAnswerSchema>;
export const practiceResultSchema = z.object({
  state: z.enum(['correct', 'partial', 'incorrect']),
  answer: practiceAnswerSchema.nullable().optional(),
  targets: z.array(z.object({id: opaqueId, state: z.string().max(24), correct_answer: z.string().max(500).nullable()})).max(12),
  feedback: z.object({
    topic: z.string().max(191).nullable(),
    sense: z.object({phrase: z.string().max(191), definition: z.string().max(1000), translation: z.string().max(512).nullable()}).nullable(),
    explanation: z.object({text: z.string().max(4000), language: z.string().max(16)}).nullable(),
  }).nullable(),
  session: z.object({status: z.enum(['open', 'finished', 'abandoned']), answered: z.int().nonnegative(), correct: z.int().nonnegative(), total: z.int().positive()}),
});
export const practiceSessionSchema = z.object({
  uuid,
  skill_key: z.string().max(96),
  level: z.string().max(2),
  status: z.enum(['open', 'finished', 'abandoned']),
  total: z.int().positive().max(20),
  answered: z.int().nonnegative(),
  correct: z.int().nonnegative(),
  questions: z.array(z.object({question: practiceQuestionSchema, result: practiceResultSchema.omit({session: true}).nullable()})).max(20),
});
export const practiceSkillsSchema = z.object({skills: z.array(z.string().max(96)).max(20)});

export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;
export type PracticeResult = z.infer<typeof practiceResultSchema>;
export type PracticeSession = z.infer<typeof practiceSessionSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Entitlements = z.infer<typeof entitlementsSchema>;
export type RewriteChecks = NonNullable<Entitlements['rewrite_checks']>;
export type RewriteCheck = z.infer<typeof rewriteCheckSchema>['check'];
export type Catalog = z.infer<typeof catalogSchema>;
export type PracticeTask = z.infer<typeof practiceTaskSchema>;
export type AttemptSummary = z.infer<typeof attemptSummarySchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AssessmentResult = z.infer<typeof assessmentResultSchema>;
export type ResultFinding = z.infer<typeof resultFindingSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Report = z.infer<typeof reportSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type ReportedResult = z.infer<typeof reportedResultSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type Vocabulary = z.infer<typeof vocabularySchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type Plan = z.infer<typeof planSchema>;
export type VocabularyList = z.infer<typeof vocabularyListSchema>;
