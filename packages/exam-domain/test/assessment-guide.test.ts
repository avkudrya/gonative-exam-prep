import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
  assessmentGuide, bandFromChecklist, checkGuideAgainstRubric, findTask, missingAnswers,
  type AssessmentGuide, type Checklist, type GuideCriterion,
} from '../src/index.js';
import {catalogExam} from './catalog.js';

const raw = () => JSON.parse(readFileSync(new URL('../guides/ielts-writing-task-2.v1.json', import.meta.url), 'utf8'));
const guide: AssessmentGuide = assessmentGuide.parse(raw());
const criterion = (key: string) => guide.criteria.find(c => c.criterionKey === key)!;

/** A checklist answering every feature by band (true up to and including `upTo`) and limiters as given. */
function checklist(c: GuideCriterion, upTo: number, limiters: string[] = [], overrides: Record<string, boolean> = {}): Checklist {
  const features = Object.fromEntries(c.bands.flatMap(b => b.features.map(f => [f.id, b.band <= upTo])));
  return {
    features: {...features, ...overrides},
    limiters: Object.fromEntries(c.limiters.map(l => [l.id, limiters.includes(l.id)])),
  };
}

test('the Task 2 guide fits the verified Task 2 rubric of both IELTS variants', () => {
  for (const key of ['ielts-academic', 'ielts-general-training']) {
    const {rubric} = findTask(catalogExam(key).versions[0], 'writing', 'task-2')!;
    assert.deepEqual(checkGuideAgainstRubric(guide, rubric), [], key);
  }
  const {rubric: task1} = findTask(catalogExam('ielts-academic').versions[0], 'writing', 'task-1')!;
  assert.ok(checkGuideAgainstRubric(guide, task1).length > 0, 'a Task 2 guide must not pass for Task 1');
});

test('every criterion covers bands 4-9 with 3-6 features; below that is the floor band 3', () => {
  assert.equal(guide.floorBand, 3);
  for (const c of guide.criteria) {
    assert.deepEqual(c.bands.map(b => b.band), [4, 5, 6, 7, 8, 9], c.criterionKey);
  }
});

test('limiters match the bolded features of the descriptors (D1)', () => {
  const caps = Object.fromEntries(guide.criteria.flatMap(c => c.limiters.map(l => [l.id, l.capBand])));
  assert.deepEqual(caps, {
    'tr.cap.part_missing': 5,
    'tr.cap.not_essay': 4,
    'tr.cap.unrelated': 1,
    'cc.cap.paragraphing': 5,
    'cc.cap.off_topic': 2,
    'lr.cap.unrelated': 4,
    'gra.cap.simple_only': 4,
    'gra.cap.too_short': 3,
  });
  assert.deepEqual(criterion('coherence_cohesion').limiters[0].autoTrigger, {kind: 'single_paragraph'});
});

test('a guide cannot claim review or approval it does not have', () => {
  assert.equal(guide.status, 'reviewed');
  assert.equal(guide.review?.vendor, 'openai', 'the second vendor differs from the drafting one (Anthropic)');
  const {review, ...unreviewed} = raw();
  assert.ok(!assessmentGuide.safeParse(unreviewed).success, 'reviewed without a review');
  assert.ok(assessmentGuide.safeParse({...unreviewed, status: 'draft'}).success);
  assert.ok(!assessmentGuide.safeParse({...raw(), status: 'approved'}).success, 'approved without a date');
  assert.ok(assessmentGuide.safeParse({...raw(), status: 'approved', approvedAt: '2026-11-25'}).success);
  assert.ok(review);
});

test('the schema rejects duplicate ids, gaps between bands and ids from another band', () => {
  const broken = (mutate: (g: any) => void) => {
    const g = raw();
    mutate(g);
    return assessmentGuide.safeParse(g).success;
  };
  assert.equal(broken(g => { g.criteria[0].bands[1].features[0].id = g.criteria[0].bands[0].features[0].id; }), false);
  assert.equal(broken(g => { g.criteria[0].bands.splice(2, 1); }), false);
  assert.equal(broken(g => { g.criteria[0].bands[0].features[0].id = 'tr5.moved'; }), false);
  assert.equal(broken(g => { g.criteria[0].limiters[0].capBand = 9; }), false);
});

test('band = highest band reached by climbing; all met is 9, none met is the floor', () => {
  const tr = criterion('task_response');
  assert.deepEqual(bandFromChecklist(tr, 3, checklist(tr, 9)), {low: 9, high: 9, consistent: true, appliedCaps: []});
  assert.deepEqual(bandFromChecklist(tr, 3, checklist(tr, 0)), {low: 3, high: 3, consistent: true, appliedCaps: []});
  assert.deepEqual(bandFromChecklist(tr, 3, checklist(tr, 6)), {low: 6, high: 6, consistent: true, appliedCaps: []});
});

test('one missing feature of the next band widens the range upwards', () => {
  const lr = criterion('lexical_resource');
  const band8 = lr.bands.find(b => b.band === 8)!;
  const almost8 = Object.fromEntries(band8.features.slice(1).map(f => [f.id, true]));
  assert.deepEqual(bandFromChecklist(lr, 3, checklist(lr, 7, [], almost8)), {low: 7, high: 8, consistent: true, appliedCaps: []});
});

test('contradictory answers (a higher band met above a failed one) give a wide, inconsistent range', () => {
  const cc = criterion('coherence_cohesion');
  const failed6 = {[cc.bands.find(b => b.band === 6)!.features[0].id]: false};
  const result = bandFromChecklist(cc, 3, checklist(cc, 7, [], failed6));
  assert.deepEqual(result, {low: 5, high: 7, consistent: false, appliedCaps: []});
});

test('limiters cap the band however many features are met', () => {
  const tr = criterion('task_response');
  assert.deepEqual(bandFromChecklist(tr, 3, checklist(tr, 9, ['tr.cap.part_missing'])),
    {low: 5, high: 5, consistent: true, appliedCaps: ['tr.cap.part_missing']});
  assert.deepEqual(bandFromChecklist(tr, 3, checklist(tr, 9, ['tr.cap.part_missing', 'tr.cap.unrelated'])).high, 1);
  const gra = criterion('grammatical_range_accuracy');
  assert.equal(bandFromChecklist(gra, 3, checklist(gra, 4, ['gra.cap.too_short'])).high, 3);
});

test('an incomplete checklist is an integrity error, not a lower band', () => {
  const gra = criterion('grammatical_range_accuracy');
  const partial = checklist(gra, 6);
  delete partial.features['gra9.punctuation_throughout'];
  delete partial.limiters['gra.cap.simple_only'];
  assert.deepEqual(missingAnswers(gra, partial), ['gra9.punctuation_throughout', 'gra.cap.simple_only']);
  assert.throws(() => bandFromChecklist(gra, 3, partial), /unanswered/);
});
