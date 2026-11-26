import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

// The practice library is our own prompts, each approved by the second-vendor review (P2.8).
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(root + path, 'utf8'));
const library = read('packages/exam-domain/library/ielts-writing-task-2.v1.json');
const sources = read('benchmarks/sources/task2-prompts.json');
const TYPES: Record<string, string> = {opinion: 'opinion', discussion: 'discussion', advantages: 'advantages', problem: 'problem_solution', two_part: 'two_part'};

test('the Task 2 library holds every own prompt once, typed as in its source and approved by the review', () => {
  assert.equal(library.origin, 'curated');
  assert.deepEqual(library.examKeys, ['ielts-academic', 'ielts-general-training']);
  assert.equal(library.tasks.length, sources.prompts.length);
  const byRef = new Map(sources.prompts.map((p: {id: string}) => [`gonative-bench:${p.id}`, p]));
  const texts = new Set<string>();
  for (const t of library.tasks) {
    const source = byRef.get(t.ref) as {type: string; topic: string; text: string} | undefined;
    assert.ok(source, t.ref);
    assert.equal(t.type, TYPES[source.type], t.ref);
    assert.equal(t.topic, source.topic, t.ref);
    assert.equal(t.text, source.text, `${t.ref}: no revision was approved, so the text is the source text`);
    assert.deepEqual(t.review, {verdict: 'approve', clarity: 'ok', typeMatches: true, fairness: 'ok', originality: t.review.originality});
    assert.notEqual(t.review.originality, 'near_copy', t.ref);
    assert.ok(['easier', 'standard', 'harder'].includes(t.difficulty), t.ref);
    assert.ok(t.text.length >= 20 && t.text.length <= 600 && /[?.]$/.test(t.text.trim()), t.ref);
    texts.add(t.text);
  }
  assert.equal(texts.size, library.tasks.length, 'texts are unique');
});

// P5.2: the Academic Task 1 library — our own tasks with invented data, drawn by code, reviewed by a second vendor.
const task1 = read('packages/exam-domain/library/ielts-writing-task-1-academic.v1.json');
const task1Sources = read('benchmarks/sources/task1-academic-charts.json');

test('the Academic Task 1 library holds every own task once with valid illustrative data, approved or revised as reviewed', async () => {
  const {checkChartSpec} = await import('../src/index.js');
  const {createHash} = await import('node:crypto');
  assert.equal(task1.source.sha256, createHash('sha256').update(readFileSync(root + task1.source.file)).digest('hex'), 'the library names its exact source');
  assert.deepEqual([task1.taskKey, task1.rubricKey, task1.examKeys], ['task-1', 'ielts-writing-task-1', ['ielts-academic']]);
  assert.equal(task1.tasks.length, task1Sources.items.length);
  const bySource = new Map(task1Sources.items.map((i: {id: string}) => [`gonative-t1a:${i.id}`, i]));
  for (const t of task1.tasks) {
    const s = bySource.get(t.ref) as {type: string; instruction: string; spec: unknown};
    assert.ok(s, t.ref);
    assert.deepEqual([t.type, t.text, t.stimulus], [s.type, s.instruction, s.spec], t.ref);
    assert.deepEqual(checkChartSpec(t.stimulus), [], t.ref);
    assert.ok(['approve', 'revise'].includes(t.review.verdict) && t.review.originality !== 'near_copy', t.ref);
    assert.equal(t.review.verdict === 'revise', task1.review.revisionsApplied.includes(t.ref.split(':')[1]), t.ref);
    assert.match(t.text, /Write at least 150 words\.$/, t.ref);
  }
  const types = task1.tasks.reduce((m: Record<string, number>, t: {type: string}) => ({...m, [t.type]: (m[t.type] ?? 0) + 1}), {});
  assert.deepEqual(types, {line: 6, bar: 6, pie: 4, pair: 4, table: 4});
});
