import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findTask, rubric} from '../src/index.js';
import {catalogExam, loadCatalog} from './catalog.js';

// Facts below were checked against ielts.org on 2026-11-23 (docs/phase-0/D1-ielts-writing-spec.md).
// A failing test here means the catalog drifted from the verified specification.

test('every catalog file parses and every served version is verified with dated sources', () => {
  const entries = loadCatalog();
  assert.ok(entries.length >= 2);
  for (const {file, provider, exam} of entries) {
    assert.equal(exam.providerKey, provider.key, file);
    for (const v of exam.versions) {
      assert.equal(v.status, 'verified', file);
      assert.ok(v.verifiedAt, file);
      for (const s of [...v.sources, ...v.rubrics.flatMap(r => r.sources)]) assert.ok(s.retrievedAt, `${file}: ${s.url}`);
    }
  }
});

for (const key of ['ielts-academic', 'ielts-general-training']) {
  test(`${key}: Writing structure, timing, minimum words and weighting`, () => {
    const v = catalogExam(key).versions[0];
    const writing = v.sections.find(s => s.key === 'writing')!;
    assert.equal(writing.timeMinutes, 60);
    const t1 = findTask(v, 'writing', 'task-1')!;
    const t2 = findTask(v, 'writing', 'task-2')!;
    assert.deepEqual([t1.task.timeMinutes, t1.task.words?.min], [20, 150]);
    assert.deepEqual([t2.task.timeMinutes, t2.task.words?.min], [40, 250]);
    assert.deepEqual(writing.aggregation, {kind: 'weighted_mean', weights: {'task-1': 1, 'task-2': 2}});
  });

  test(`${key}: four equally weighted criteria on whole bands, task result in half bands`, () => {
    const v = catalogExam(key).versions[0];
    const names = (k: string) => v.rubrics.find(r => r.key === k)!.criteria.map(c => c.officialName);
    assert.deepEqual(names('ielts-writing-task-1'), ['Task Achievement', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy']);
    assert.deepEqual(names('ielts-writing-task-2'), ['Task Response', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy']);
    for (const r of v.rubrics) {
      assert.ok(r.aggregation.kind === 'weighted_mean' && Object.values(r.aggregation.weights).every(w => w === 1));
      assert.ok(r.criteria.every(c => c.scale.kind === 'band' && c.scale.step === 1 && c.scale.max === 9));
      assert.ok(r.scale.kind === 'band' && r.scale.step === 0.5);
      assert.deepEqual(r.rules, [
        {kind: 'short_response', maxWords: 20, score: 1},
        {kind: 'discount_copied_prompt'},
        {kind: 'wrong_language', score: 0},
      ]);
    }
  });
}

test('Academic Task 1 is visual information, General Training Task 1 is a letter', () => {
  const academic = findTask(catalogExam('ielts-academic').versions[0], 'writing', 'task-1')!.task;
  const general = findTask(catalogExam('ielts-general-training').versions[0], 'writing', 'task-1')!.task;
  assert.equal(academic.responseGenre, 'report');
  assert.deepEqual(academic.stimuli, ['structured_data', 'diagram', 'map']);
  assert.equal(general.responseGenre, 'letter');
});

test('Academic and General Training share the same band descriptors', () => {
  const a = catalogExam('ielts-academic').versions[0].rubrics;
  const g = catalogExam('ielts-general-training').versions[0].rubrics;
  assert.deepEqual(a, g);
});

test('a rule score off the criterion scale is rejected', () => {
  const r = structuredClone(catalogExam('ielts-academic').versions[0].rubrics[0]);
  r.rules = [{kind: 'short_response', maxWords: 20, score: 1.5}];
  assert.throws(() => rubric.parse(r), /not on the scale/);
});
