import {z} from 'zod';

/*
 * Exam configuration contract (draft, Phase 0 C/I).
 *
 * Language → Provider → Exam → ExamVersion → Section → TaskType → Rubric → Criterion.
 * Nothing here knows about IELTS: band scales, point totals, ordered levels and purely
 * descriptive assessment are all values of the same `scoreScale`. The backend
 * (MultiAdmin `Exam` module) owns the stored configuration; this package mirrors its
 * API shape for the web client and the benchmark tooling.
 */

export const slug = z.string().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, 'lowercase slug');

/** BCP 47 subset used across GoNative: language with an optional region (en, de, pt-PT). */
export const languageTag = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, 'BCP 47 language tag');

export const sourceRef = z.object({
  url: z.url(),
  title: z.string().min(1),
  retrievedAt: z.iso.date().optional(),
});

/**
 * How an UNCALIBRATED estimate may be shown (ADR-003): a range at least `minWidth` wide,
 * snapped outward to a `step` grid. A numeric scale without it shows no number until calibrated.
 */
export const approximateDisplay = z.object({step: z.number().positive(), minWidth: z.number().positive()});

export const scoreScale = z.discriminatedUnion('kind', [
  /** Numeric bands, e.g. IELTS 0–9. */
  z.object({kind: z.literal('band'), min: z.number(), max: z.number(), step: z.number().positive(), approximate: approximateDisplay.optional()})
    .refine(s => s.max > s.min, 'max must exceed min'),
  /** Points from 0 to max, e.g. a module scored out of 100. */
  z.object({kind: z.literal('points'), max: z.number().positive(), approximate: approximateDisplay.optional()}),
  /** Ordered labels, lowest first (CEFR, pass/fail, A–E). */
  z.object({kind: z.literal('levels'), levels: z.array(z.string().min(1)).min(2)}),
  /** No score at all: feedback only. */
  z.object({kind: z.literal('descriptive')}),
]);

export const rounding = z.object({step: z.number().positive(), mode: z.enum(['nearest', 'down', 'up'])});

/** How child results (criteria → task, tasks → section) combine. Weights are relative. */
export const aggregation = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('weighted_mean'), weights: z.record(slug, z.number().positive()), rounding: rounding.optional()}),
  z.object({kind: z.literal('sum'), scaleTo: z.number().positive().optional()}),
  z.object({kind: z.literal('none')}),
]);

export const criterion = z.object({
  key: slug,
  /** Name in the exam's own terminology and language; UI translations live in the web app. */
  officialName: z.string().min(1),
  scale: scoreScale,
});

/**
 * Deterministic rules an exam's descriptors state outright; they apply before and above any
 * AI judgement. Scores are values of every criterion scale of the rubric.
 */
export const rubricRule = z.discriminatedUnion('kind', [
  /** Responses of at most `maxWords` words get `score` on every criterion (IELTS: ≤ 20 words → Band 1). */
  z.object({kind: z.literal('short_response'), maxWords: z.int().positive(), score: z.number()}),
  /** Text copied from the task prompt earns no credit and is left out of the word count. */
  z.object({kind: z.literal('discount_copied_prompt')}),
  /** A response written in another language throughout gets `score` (IELTS: Band 0). */
  z.object({kind: z.literal('wrong_language'), score: z.number()}),
]);

export const rubric = z.object({
  key: slug,
  version: z.string().min(1),
  officialName: z.string().min(1),
  sources: z.array(sourceRef).min(1),
  criteria: z.array(criterion).min(1),
  aggregation,
  /** Scale of the combined task result. */
  scale: scoreScale,
  rules: z.array(rubricRule).optional(),
}).superRefine((r, ctx) => {
  r.rules?.forEach((rule, i) => {
    if (rule.kind === 'discount_copied_prompt') return;
    for (const c of r.criteria) {
      if (!isOnScale(c.scale, rule.score)) {
        ctx.addIssue({code: 'custom', path: ['rules', i, 'score'], message: `score ${rule.score} is not on the scale of ${c.key}`});
      }
    }
  });
});

export const stimulusKind = z.enum(['text_prompt', 'structured_data', 'diagram', 'map']);

export const taskType = z.object({
  key: slug,
  officialName: z.string().min(1),
  responseGenre: z.enum(['essay', 'report', 'letter', 'email', 'forum_post', 'summary', 'other']),
  /** Every kind of input this task type may present (IELTS Academic Task 1: data, diagrams or maps). */
  stimuli: z.array(stimulusKind).min(1),
  timeMinutes: z.number().positive().optional(),
  words: z.object({
    min: z.int().positive().optional(),
    max: z.int().positive().optional(),
    target: z.int().positive().optional(),
  }).optional(),
  rubricKey: slug,
});

export const section = z.object({
  key: slug,
  skill: z.enum(['writing', 'reading', 'listening', 'speaking']),
  officialName: z.string().min(1),
  timeMinutes: z.number().positive().optional(),
  tasks: z.array(taskType).min(1),
  aggregation,
  scale: scoreScale,
});

export const examVersion = z.object({
  version: z.string().min(1),
  /** draft = facts not yet checked against the official sources; only verified versions serve users. */
  status: z.enum(['draft', 'verified', 'retired']),
  verifiedAt: z.iso.date().nullable(),
  effectiveFrom: z.iso.date().optional(),
  sources: z.array(sourceRef).min(1),
  sections: z.array(section).min(1),
  rubrics: z.array(rubric).min(1),
}).superRefine((version, ctx) => {
  if (version.status === 'verified' && !version.verifiedAt) {
    ctx.addIssue({code: 'custom', path: ['verifiedAt'], message: 'a verified version needs verifiedAt'});
  }
  const rubricKeys = new Set<string>();
  version.rubrics.forEach((r, i) => {
    if (rubricKeys.has(r.key)) ctx.addIssue({code: 'custom', path: ['rubrics', i, 'key'], message: `duplicate rubric ${r.key}`});
    rubricKeys.add(r.key);
    checkWeights(ctx, ['rubrics', i, 'aggregation'], r.aggregation, r.criteria.map(c => c.key));
  });
  version.sections.forEach((s, i) => {
    checkWeights(ctx, ['sections', i, 'aggregation'], s.aggregation, s.tasks.map(t => t.key));
    s.tasks.forEach((t, j) => {
      if (!rubricKeys.has(t.rubricKey)) {
        ctx.addIssue({code: 'custom', path: ['sections', i, 'tasks', j, 'rubricKey'], message: `unknown rubric ${t.rubricKey}`});
      }
    });
  });
});

export const examProvider = z.object({
  key: slug,
  officialName: z.string().min(1),
  website: z.url(),
});

export const exam = z.object({
  key: slug,
  providerKey: slug,
  learningLanguage: languageTag,
  officialName: z.string().min(1),
  versions: z.array(examVersion).min(1),
});

export type ScoreScale = z.infer<typeof scoreScale>;
export type Aggregation = z.infer<typeof aggregation>;
export type Criterion = z.infer<typeof criterion>;
export type RubricRule = z.infer<typeof rubricRule>;
export type Rubric = z.infer<typeof rubric>;
export type TaskType = z.infer<typeof taskType>;
export type Section = z.infer<typeof section>;
export type ExamVersion = z.infer<typeof examVersion>;
export type ExamProvider = z.infer<typeof examProvider>;
export type Exam = z.infer<typeof exam>;

/** Weighted means must name exactly the children they combine. */
function checkWeights(ctx: z.RefinementCtx, path: (string | number)[], agg: Aggregation, childKeys: string[]) {
  if (agg.kind !== 'weighted_mean') return;
  const weightKeys = Object.keys(agg.weights).sort();
  const expected = [...childKeys].sort();
  if (weightKeys.join() !== expected.join()) {
    ctx.addIssue({code: 'custom', path, message: `weights [${weightKeys}] must match [${expected}]`});
  }
}

export function findTask(version: ExamVersion, sectionKey: string, taskKey: string): {section: Section; task: TaskType; rubric: Rubric} | null {
  const s = version.sections.find(x => x.key === sectionKey);
  const t = s?.tasks.find(x => x.key === taskKey);
  const r = t && version.rubrics.find(x => x.key === t.rubricKey);
  return s && t && r ? {section: s, task: t, rubric: r} : null;
}

/** Whether a number is a legal value of a numeric scale (on a band step or within points). */
export function isOnScale(scale: ScoreScale, value: number): boolean {
  switch (scale.kind) {
    case 'band': {
      if (value < scale.min || value > scale.max) return false;
      const steps = (value - scale.min) / scale.step;
      return Math.abs(steps - Math.round(steps)) < 1e-9;
    }
    case 'points':
      return value >= 0 && value <= scale.max;
    default:
      return false;
  }
}
