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
