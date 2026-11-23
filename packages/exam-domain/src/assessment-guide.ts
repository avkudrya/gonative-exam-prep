import {z} from 'zod';
import {isOnScale, type Rubric} from './exam-config.js';

/*
 * Assessment guide: our own, checkable wording of what each band of a criterion looks like
 * (docs/phase-1/P1.1-assessment-guide.md). The model answers every feature and limiter
 * true/false with evidence; it never names a band. Code turns the checklist into a band
 * range (`bandFromChecklist`), the rule the PHP pipeline mirrors.
 *
 * Feature evidence says which answer must quote the response:
 *  - `met`       — a true answer quotes the text that shows it (presence: "uses less common items");
 *  - `not_met`   — a false answer quotes the text that breaks it (absence: "errors do not impede");
 *  - `structure` — about layout or the whole text (paragraphing); a reason is enough, quotes optional.
 * Every answer carries a one-sentence reason.
 */

const featureId = z.string().regex(/^[a-z]+[0-9]\.[a-z0-9_]+$/, 'feature id: <prefix><band>.<name>');
const limiterId = z.string().regex(/^[a-z]+\.cap\.[a-z0-9_]+$/, 'limiter id: <prefix>.cap.<name>');

export const guideFeature = z.object({
  id: featureId,
  statement: z.string().min(20),
  evidence: z.enum(['met', 'not_met', 'structure']),
});

export const guideBand = z.object({
  band: z.int(),
  features: z.array(guideFeature).min(3).max(6),
  /** Guidance for the assessor that is not a pass/fail condition. */
  notes: z.array(z.string().min(1)).optional(),
});

/**
 * Deterministic triggers: code applies the limiter's cap itself instead of relying on the model.
 *  - `single_paragraph`, `list_form` — the rubric rules' flags of the same name;
 *  - `limiter` — another criterion's limiter applied: found in its checklist (P2), or that criterion's
 *    direct band (P0/P1) is at or below the referenced cap. Stage A (P1.7): models lowered TR for an
 *    off-topic essay but left CC and LR high.
 */
export const limiterTrigger = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('single_paragraph')}),
  z.object({kind: z.literal('list_form')}),
  z.object({kind: z.literal('limiter'), limiterId}),
]);

export const guideLimiter = z.object({
  id: limiterId,
  statement: z.string().min(20),
  /** If present, the criterion cannot be rated above this band. */
  capBand: z.int(),
  evidence: z.enum(['quote', 'structure']),
  autoTrigger: limiterTrigger.optional(),
});

export const guideCriterion = z.object({
  criterionKey: z.string().min(1),
  idPrefix: z.string().regex(/^[a-z]+$/),
  /** What this criterion judges, so the assessor does not mix criteria. */
  focus: z.string().min(20),
  notThis: z.string().min(10),
  bands: z.array(guideBand).min(1),
  limiters: z.array(guideLimiter),
});

export const assessmentGuide = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string().regex(/^v[0-9]+$/),
  status: z.enum(['draft', 'reviewed', 'approved']),
  rubricKey: z.string().min(1),
  rubricVersion: z.string().min(1),
  basedOn: z.object({title: z.string().min(1), edition: z.string().min(1), url: z.url(), note: z.string().min(1)}),
  /** Rated when no guide band is fully met (lower bands come from rubric rules and limiters). */
  floorBand: z.int(),
  instructions: z.array(z.string().min(10)).min(1),
  criteria: z.array(guideCriterion).min(1),
  review: z.object({vendor: z.string(), model: z.string(), date: z.iso.date(), runRef: z.string()}).optional(),
  approvedAt: z.iso.date().optional(),
}).superRefine((g, ctx) => {
  if (g.status !== 'draft' && !g.review) ctx.addIssue({code: 'custom', path: ['review'], message: `${g.status} needs a review`});
  if (g.status === 'approved' && !g.approvedAt) ctx.addIssue({code: 'custom', path: ['approvedAt'], message: 'approved needs approvedAt'});

  const ids = new Set<string>();
  const unique = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) ctx.addIssue({code: 'custom', path, message: `duplicate id ${id}`});
    ids.add(id);
  };
  const prefixes = new Set<string>();
  g.criteria.forEach((c, ci) => {
    if (prefixes.has(c.idPrefix)) ctx.addIssue({code: 'custom', path: ['criteria', ci, 'idPrefix'], message: `duplicate prefix ${c.idPrefix}`});
    prefixes.add(c.idPrefix);

    const bands = c.bands.map(b => b.band);
    const expected = bands.map((_, i) => bands[0] + i);
    if (bands.join() !== expected.join()) {
      ctx.addIssue({code: 'custom', path: ['criteria', ci, 'bands'], message: 'bands must be ascending and contiguous'});
    }
    if (bands[0] !== g.floorBand + 1) {
      ctx.addIssue({code: 'custom', path: ['criteria', ci, 'bands'], message: 'lowest guide band must be floorBand + 1'});
    }
    c.bands.forEach((b, bi) => b.features.forEach((f, fi) => {
      const path = ['criteria', ci, 'bands', bi, 'features', fi, 'id'];
      unique(f.id, path);
      if (!f.id.startsWith(`${c.idPrefix}${b.band}.`)) ctx.addIssue({code: 'custom', path, message: `expected ${c.idPrefix}${b.band}.*`});
    }));
    c.limiters.forEach((l, li) => {
      const path = ['criteria', ci, 'limiters', li];
      unique(l.id, [...path, 'id']);
      if (!l.id.startsWith(`${c.idPrefix}.cap.`)) ctx.addIssue({code: 'custom', path: [...path, 'id'], message: `expected ${c.idPrefix}.cap.*`});
      if (l.capBand >= bands[bands.length - 1]) ctx.addIssue({code: 'custom', path: [...path, 'capBand'], message: 'a cap at or above the top band limits nothing'});
    });
  });

  // A limiter trigger names a limiter of another criterion that code does not trigger the same way
  // (one level: no chains, no cycles).
  const limiters = new Map(g.criteria.flatMap(c => c.limiters.map(l => [l.id, {criterion: c.criterionKey, limiter: l}] as const)));
  g.criteria.forEach((c, ci) => c.limiters.forEach((l, li) => {
    if (l.autoTrigger?.kind !== 'limiter') return;
    const path = ['criteria', ci, 'limiters', li, 'autoTrigger', 'limiterId'];
    const target = limiters.get(l.autoTrigger.limiterId);
    if (!target) ctx.addIssue({code: 'custom', path, message: `unknown limiter ${l.autoTrigger.limiterId}`});
    else if (target.criterion === c.criterionKey) ctx.addIssue({code: 'custom', path, message: 'a limiter trigger must name another criterion'});
    else if (target.limiter.autoTrigger?.kind === 'limiter') ctx.addIssue({code: 'custom', path, message: 'limiter triggers cannot chain'});
  }));
});

export type GuideFeature = z.infer<typeof guideFeature>;
export type GuideLimiter = z.infer<typeof guideLimiter>;
export type GuideCriterion = z.infer<typeof guideCriterion>;
export type AssessmentGuide = z.infer<typeof assessmentGuide>;

/** The guide must describe exactly the rubric's criteria, on their scales. */
export function checkGuideAgainstRubric(guide: AssessmentGuide, rubric: Rubric): string[] {
  const problems: string[] = [];
  if (guide.rubricKey !== rubric.key) problems.push(`guide is for ${guide.rubricKey}, rubric is ${rubric.key}`);
  if (guide.rubricVersion !== rubric.version) problems.push(`guide is for rubric ${guide.rubricVersion}, rubric is ${rubric.version}`);
  const guided = guide.criteria.map(c => c.criterionKey).sort().join();
  const rubricKeys = rubric.criteria.map(c => c.key).sort().join();
  if (guided !== rubricKeys) problems.push(`guide criteria [${guided}] differ from rubric [${rubricKeys}]`);
  for (const c of guide.criteria) {
    const scale = rubric.criteria.find(r => r.key === c.criterionKey)?.scale;
    if (!scale) continue;
    const values = [guide.floorBand, ...c.bands.map(b => b.band), ...c.limiters.map(l => l.capBand)];
    for (const v of values) if (!isOnScale(scale, v)) problems.push(`${c.criterionKey}: ${v} is not on the scale`);
  }
  return problems;
}

export type Checklist = {features: Record<string, boolean>; limiters: Record<string, boolean>};

export type ChecklistBand = {
  low: number;
  high: number;
  /** False when a higher band is met while a lower one is not: the answers contradict each other. */
  consistent: boolean;
  appliedCaps: string[];
};

/** Ids the checklist must answer for this criterion; unanswered ones are an integrity error. */
export function missingAnswers(criterion: GuideCriterion, checklist: Checklist): string[] {
  const features = criterion.bands.flatMap(b => b.features.map(f => f.id)).filter(id => !(id in checklist.features));
  const limiters = criterion.limiters.map(l => l.id).filter(id => !(id in checklist.limiters));
  return [...features, ...limiters];
}

/**
 * Band range from a complete checklist (docs/phase-0/D §2 step 4):
 *  - low: the highest band reached by climbing from the bottom while every band is fully met;
 *  - high: the highest fully met band, or one above `low` when that band misses a single feature;
 *  - present limiters cap both ends.
 * No fully met guide band → floorBand.
 */
export function bandFromChecklist(criterion: GuideCriterion, floorBand: number, checklist: Checklist): ChecklistBand {
  const missing = missingAnswers(criterion, checklist);
  if (missing.length) throw new Error(`unanswered: ${missing.join(', ')}`);

  const unmet = (band: GuideCriterion['bands'][number]) => band.features.filter(f => !checklist.features[f.id]).length;
  let staircase = floorBand;
  for (const band of criterion.bands) {
    if (unmet(band) > 0) break;
    staircase = band.band;
  }
  const top = Math.max(floorBand, ...criterion.bands.filter(b => unmet(b) === 0).map(b => b.band));
  const next = criterion.bands.find(b => b.band === staircase + 1);
  const nearNext = next !== undefined && unmet(next) === 1;

  let low = staircase;
  let high = Math.max(top, nearNext ? staircase + 1 : staircase);
  const caps = criterion.limiters.filter(l => checklist.limiters[l.id]);
  for (const cap of caps) {
    low = Math.min(low, cap.capBand);
    high = Math.min(high, cap.capBand);
  }
  return {low, high, consistent: top === staircase, appliedCaps: caps.map(c => c.id)};
}
