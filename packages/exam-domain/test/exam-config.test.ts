import assert from 'node:assert/strict';
import {test} from 'node:test';
import {exam, examProvider, findTask, isOnScale} from '../src/index.js';
import {catalogExam, loadCatalog} from './catalog.js';
import {goetheB1, goetheProvider} from './fixtures/goethe-b1.js';

const ielts = () => catalogExam('ielts-academic');

test('one model describes IELTS Academic and Goethe B1 (spec §5, §24.4)', () => {
  const ieltsProvider = loadCatalog().find(e => e.exam.key === 'ielts-academic')!.provider;
  for (const [provider, config] of [[ieltsProvider, ielts()], [goetheProvider, goetheB1]] as const) {
    examProvider.parse(provider);
    assert.equal(exam.parse(config).providerKey, provider.key);
  }
});

test('different learning languages, scales and aggregation rules coexist', () => {
  const i = ielts().versions[0].sections[0];
  const g = goetheB1.versions[0].sections[0];
  assert.notEqual(ielts().learningLanguage, goetheB1.learningLanguage);
  assert.equal(i.scale.kind, 'band');
  assert.equal(g.scale.kind, 'points');
  assert.equal(i.aggregation.kind, 'weighted_mean');
  assert.equal(g.aggregation.kind, 'sum');
});

test('a task resolves to its rubric', () => {
  const found = findTask(ielts().versions[0], 'writing', 'task-2');
  assert.equal(found?.rubric.criteria[0].key, 'task_response');
  assert.equal(findTask(ielts().versions[0], 'writing', 'task-3'), null);
});

test('a task pointing at a missing rubric is rejected', () => {
  const broken = structuredClone(ielts());
  broken.versions[0].sections[0].tasks[1].rubricKey = 'nope';
  assert.throws(() => exam.parse(broken), /unknown rubric nope/);
});

test('weights must name exactly the children they combine', () => {
  const broken = structuredClone(ielts());
  broken.versions[0].sections[0].aggregation = {kind: 'weighted_mean', weights: {'task-2': 1}};
  assert.throws(() => exam.parse(broken), /weights/);
});

test('a verified version must say when it was verified', () => {
  const broken = structuredClone(ielts());
  broken.versions[0].verifiedAt = null;
  assert.throws(() => exam.parse(broken), /verifiedAt/);
});

test('band scales accept only values on the step', () => {
  const scale = {kind: 'band', min: 0, max: 9, step: 0.5} as const;
  assert.ok(isOnScale(scale, 6.5));
  assert.ok(!isOnScale(scale, 6.25));
  assert.ok(!isOnScale(scale, 9.5));
  assert.ok(!isOnScale({kind: 'descriptive'}, 1));
});
