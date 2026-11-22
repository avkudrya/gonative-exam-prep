import assert from 'node:assert/strict';
import {test} from 'node:test';
import {exam, examProvider, findTask, isOnScale} from '../src/index.js';
import {goetheB1, goetheProvider} from './fixtures/goethe-b1.js';
import {ieltsAcademic, ieltsProvider} from './fixtures/ielts-academic.js';

test('one model describes IELTS Academic and Goethe B1 (spec §5, §24.4)', () => {
  for (const [provider, config] of [[ieltsProvider, ieltsAcademic], [goetheProvider, goetheB1]] as const) {
    examProvider.parse(provider);
    const parsed = exam.parse(config);
    assert.equal(parsed.providerKey, provider.key);
  }
});

test('different learning languages, scales and aggregation rules coexist', () => {
  const ielts = ieltsAcademic.versions[0].sections[0];
  const goethe = goetheB1.versions[0].sections[0];
  assert.notEqual(ieltsAcademic.learningLanguage, goetheB1.learningLanguage);
  assert.equal(ielts.scale.kind, 'band');
  assert.equal(goethe.scale.kind, 'points');
  assert.equal(ielts.aggregation.kind, 'weighted_mean');
  assert.equal(goethe.aggregation.kind, 'sum');
});

test('a task resolves to its rubric', () => {
  const found = findTask(ieltsAcademic.versions[0], 'writing', 'task-2');
  assert.equal(found?.rubric.criteria[0].key, 'task_response');
  assert.equal(findTask(ieltsAcademic.versions[0], 'writing', 'task-3'), null);
});

test('a task pointing at a missing rubric is rejected', () => {
  const broken = structuredClone(ieltsAcademic);
  broken.versions[0].sections[0].tasks[1].rubricKey = 'nope';
  assert.throws(() => exam.parse(broken), /unknown rubric nope/);
});

test('weights must name exactly the children they combine', () => {
  const broken = structuredClone(ieltsAcademic);
  broken.versions[0].sections[0].aggregation = {kind: 'weighted_mean', weights: {'task-2': 1}};
  assert.throws(() => exam.parse(broken), /weights/);
});

test('a verified version must say when it was verified', () => {
  const broken = structuredClone(ieltsAcademic);
  broken.versions[0].status = 'verified';
  assert.throws(() => exam.parse(broken), /verifiedAt/);
});

test('band scales accept only values on the step', () => {
  const scale = {kind: 'band', min: 0, max: 9, step: 0.5} as const;
  assert.ok(isOnScale(scale, 6.5));
  assert.ok(!isOnScale(scale, 6.25));
  assert.ok(!isOnScale(scale, 9.5));
  assert.ok(!isOnScale({kind: 'descriptive'}, 1));
});
