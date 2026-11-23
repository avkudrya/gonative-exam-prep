import {z} from 'zod';
import {isOnScale, languageTag, slug, type Rubric, type ScoreScale} from './exam-config.js';
import {skillKey} from './skills.js';
import {codePointLength, sliceCodePoints} from './text.js';

/*
 * Assessment result contract (draft, Phase 0 C/D).
 *
 * Feedback is structured: every finding names a skill, may name the rubric criterion it
 * affected, and points at the exact text it is about. Scores are ranges with an explicit
 * calibration status; an uncalibrated estimate is shown only as a deliberately coarse
 * approximate range (`presentEstimate`, docs/decisions/ADR-003).
 */

export const textSpan = z.object({start: z.int().nonnegative(), end: z.int().positive()})
  .refine(s => s.end > s.start, 'empty span');

export const finding = z.object({
  id: z.string().min(1),
  kind: z.enum(['error', 'weakness', 'strength']),
  skill: skillKey,
  criterionKey: slug.optional(),
  severity: z.enum(['minor', 'moderate', 'major']),
  /** Code-point offsets into the normalized response; `quote` must equal that slice. */
  span: textSpan.optional(),
  quote: z.string().min(1).optional(),
  suggestion: z.string().min(1).optional(),
  explanation: z.string().min(1),
}).refine(f => (f.span === undefined) === (f.quote === undefined), 'span and quote go together');

export const scoreEstimate = z.object({
  low: z.number(),
  high: z.number(),
  calibration: z.object({
    status: z.enum(['uncalibrated', 'calibrated']),
    /** Benchmark/calibration run that justifies showing this range. */
    calibrationId: z.string().min(1).optional(),
  }).refine(c => c.status === 'uncalibrated' || c.calibrationId, 'calibrated needs calibrationId'),
}).refine(e => e.low <= e.high, 'low must not exceed high');

export const criterionAssessment = z.object({
  criterionKey: slug,
  estimate: scoreEstimate.nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(1),
  findingIds: z.array(z.string().min(1)),
});

export const assessmentResult = z.object({
  schemaVersion: z.literal(1),
  /** Everything needed to reproduce which rules were applied; history is never reinterpreted. */
  exam: z.object({
    examKey: slug,
    examVersion: z.string().min(1),
    sectionKey: slug,
    taskKey: slug,
    rubricKey: slug,
    rubricVersion: z.string().min(1),
  }),
  pipelineVersion: z.string().min(1),
  feedbackLanguage: languageTag,
  response: z.object({
    wordCount: z.int().nonnegative(),
    wordCountRule: z.string().min(1),
    textSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  status: z.enum(['complete', 'partial', 'failed']),
  criteria: z.array(criterionAssessment),
  findings: z.array(finding),
});

export type TextSpan = z.infer<typeof textSpan>;
export type Finding = z.infer<typeof finding>;
export type ScoreEstimate = z.infer<typeof scoreEstimate>;
export type CriterionAssessment = z.infer<typeof criterionAssessment>;
export type AssessmentResult = z.infer<typeof assessmentResult>;

export type IntegrityProblem = {path: string; message: string};

/** Rejects findings whose span leaves the text or does not quote it exactly. */
export function checkFindingSpans(text: string, findings: Finding[]): IntegrityProblem[] {
  const length = codePointLength(text);
  const problems: IntegrityProblem[] = [];
  for (const f of findings) {
    if (!f.span) continue;
    if (f.span.end > length) {
      problems.push({path: `findings.${f.id}.span`, message: `span ends at ${f.span.end}, text has ${length} code points`});
    } else if (sliceCodePoints(text, f.span.start, f.span.end) !== f.quote) {
      problems.push({path: `findings.${f.id}.quote`, message: 'quote does not match the text at span'});
    }
  }
  return problems;
}

/**
 * Deterministic checks of an AI-produced result against the rubric it claims to apply:
 * each criterion assessed exactly once, references resolve, estimates lie on the scale.
 */
export function checkAssessmentIntegrity(result: AssessmentResult, rubric: Rubric, text: string): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  if (result.exam.rubricKey !== rubric.key || result.exam.rubricVersion !== rubric.version) {
    problems.push({path: 'exam', message: `result names ${result.exam.rubricKey}@${result.exam.rubricVersion}, rubric is ${rubric.key}@${rubric.version}`});
  }
  const findingIds = new Set<string>();
  for (const f of result.findings) {
    if (findingIds.has(f.id)) problems.push({path: `findings.${f.id}`, message: 'duplicate finding id'});
    findingIds.add(f.id);
    if (f.criterionKey && !rubric.criteria.some(c => c.key === f.criterionKey)) {
      problems.push({path: `findings.${f.id}.criterionKey`, message: `unknown criterion ${f.criterionKey}`});
    }
  }
  for (const c of rubric.criteria) {
    const n = result.criteria.filter(a => a.criterionKey === c.key).length;
    if (n !== 1) problems.push({path: `criteria.${c.key}`, message: `assessed ${n} times, expected once`});
  }
  for (const a of result.criteria) {
    const c = rubric.criteria.find(x => x.key === a.criterionKey);
    if (!c) {
      problems.push({path: `criteria.${a.criterionKey}`, message: 'criterion is not in the rubric'});
      continue;
    }
    for (const id of a.findingIds) {
      if (!findingIds.has(id)) problems.push({path: `criteria.${a.criterionKey}.findingIds`, message: `unknown finding ${id}`});
    }
    if (a.estimate && !(isOnScale(c.scale, a.estimate.low) && isOnScale(c.scale, a.estimate.high))) {
      problems.push({path: `criteria.${a.criterionKey}.estimate`, message: 'estimate is outside the criterion scale'});
    }
  }
  problems.push(...checkFindingSpans(text, result.findings));
  return problems;
}

/**
 * An official result the user reports after sitting the real exam (ADR-003, calibration path 2).
 * Self-reported and unverified: used only in aggregate, only with consent, never as one
 * person's ground truth. Section keys and values must fit the exam version's configuration.
 */
export const reportedResult = z.object({
  examKey: slug,
  examVersion: z.string().min(1),
  testDate: z.iso.date(),
  source: z.literal('self_reported'),
  sections: z.record(slug, z.number()),
  /** Separate, revocable consent to use this result for calibration statistics. */
  calibrationConsent: z.boolean(),
});
export type ReportedResult = z.infer<typeof reportedResult>;

export function checkReportedResult(result: ReportedResult, version: {sections: {key: string; scale: ScoreScale}[]}): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const entries = Object.entries(result.sections);
  if (entries.length === 0) problems.push({path: 'sections', message: 'no section result'});
  for (const [key, value] of entries) {
    const section = version.sections.find(s => s.key === key);
    if (!section) problems.push({path: `sections.${key}`, message: 'section is not in this exam version'});
    else if (!isOnScale(section.scale, value)) problems.push({path: `sections.${key}`, message: `${value} is not on the section scale`});
  }
  return problems;
}

export type PresentedEstimate ={precision: 'calibrated' | 'approximate'; low: number; high: number};

/**
 * The only way the UI gets a number (ADR-003). Calibrated ranges pass through; uncalibrated
 * ones are widened to the scale's `approximate` grid around their midpoint and clamped to the
 * scale, so they never look more precise than they are. No `approximate` config → no number.
 */
export function presentEstimate(estimate: ScoreEstimate | null, scale: ScoreScale): PresentedEstimate | null {
  if (!estimate) return null;
  if (estimate.calibration.status === 'calibrated') return {precision: 'calibrated', low: estimate.low, high: estimate.high};
  if ((scale.kind !== 'band' && scale.kind !== 'points') || !scale.approximate) return null;
  const {step, minWidth} = scale.approximate;
  const [min, max] = scale.kind === 'band' ? [scale.min, scale.max] : [0, scale.max];
  const width = Math.max(minWidth, estimate.high - estimate.low);
  const mid = (estimate.low + estimate.high) / 2;
  let low = Math.floor((mid - width / 2) / step + 1e-9) * step;
  let high = Math.ceil((mid + width / 2) / step - 1e-9) * step;
  if (low < min) [low, high] = [min, high + (min - low)];
  if (high > max) [low, high] = [low - (high - max), max];
  return {precision: 'approximate', low: tidy(Math.max(min, low)), high: tidy(high)};
}

const tidy = (n: number) => Math.round(n * 1e6) / 1e6;
