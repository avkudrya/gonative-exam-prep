import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {checkNumbers, countWords} from '../../../packages/exam-domain/src/index.js';
import {usable} from '../build.js';
import {buildT1Items, G_CASES, readT1Inputs, SPLIT} from '../build-t1.js';
import {candidates, insertionRules, reportInsertionRules} from '../insertions.js';

const {tasks, bases, essays} = readT1Inputs();
const items = buildT1Items(tasks, bases, essays);

test('the committed exam-t1a-v1 is a fresh build', () => {
  const onDisk = readFileSync(new URL('../../datasets/exam-t1a-v1/items.jsonl', import.meta.url), 'utf8');
  assert.equal(onDisk, items.map(i => JSON.stringify(i)).join('\n') + '\n', 'run npm run bench:t1');
});

test('bases are adjudicated: every one with remarks has a decision, every fix keeps the original', () => {
  for (const b of bases) {
    if (!b.check?.clean) assert.ok(b.adjudication, `${b.id} has remarks but no adjudication`);
    if (b.adjudication?.status === 'fixed') assert.ok((b as {originalText?: string}).originalText, `${b.id} fixed without originalText`);
  }
  assert.equal(bases.filter(usable).length, 30);
});

test('splits are by task and balanced; every G case is in both splits', () => {
  for (const t of tasks) assert.ok(SPLIT[t.ref.split(':')[1]], t.ref);
  const tasksOf = (split: string) => new Set(items.filter(i => i.split === split && i.set !== 'G').map(i => i.taskRef));
  const dev = tasksOf('dev');
  for (const ref of tasksOf('test')) assert.ok(!dev.has(ref), `${ref} in both splits`);
  for (const set of ['S', 'N'] as const) {
    assert.equal(items.filter(i => i.set === set && i.split === 'dev').length, 15);
    assert.equal(items.filter(i => i.set === set && i.split === 'test').length, 15);
  }
  for (const split of ['dev', 'test']) {
    assert.deepEqual(items.filter(i => i.set === 'G' && i.split === split).map(i => i.source.case).sort(), [...G_CASES].sort());
  }
  for (const i of items) assert.equal(i.split, SPLIT[i.taskRef.split(':')[1]], `${i.id}: split follows its task`);
});

test('S and N reports have no figure the code check rejects; G cases are what they say', () => {
  for (const i of items.filter(x => x.set !== 'G')) {
    assert.deepEqual(checkNumbers(i.text, i.stimulus).filter(m => m.status === 'unmatched'), [], i.id);
  }
  const g = (c: string, split = 'dev') => items.find(i => i.id === `g-t1-${c}-${split}`)!;
  for (const split of ['dev', 'test']) {
    assert.ok(!/^overall/im.test(g('no-overview', split).text));
    assert.equal(g('numbers-changed', split).expected.numbers!.unmatched.length, 3);
    const words = countWords(g('under-length', split).text);
    assert.ok(words >= 100 && words <= 140, `${words} words`);
    assert.ok(g('copied-prompt', split).text.startsWith(g('copied-prompt', split).prompt.split('. ')[0]));
    assert.match(g('list-form', split).text, /^- /m);
    assert.notEqual(g('other-chart', split).taskRef, items.find(i => i.id === `n-t1-${g('other-chart', split).source.base}`)!.taskRef);
    assert.ok((g('data-dump', split).text.match(/\.(?:\s|$)/g) ?? []).length >= 12, 'one sentence per value');
  }
});

test('report rules produce the intended learner errors and never touch a figure', () => {
  const cases: Array<[string, string, string]> = [
    ['tense.regularised_past', 'Sales rose to 40', 'rised'],
    ['agreement.number_of', 'the number of commuters was 300', 'commuters were'],
    ['agreement.plural_figures', 'the figures were similar', 'figures was'],
    ['preposition.change_by', 'it fell by 20 points', 'fell with'],
    ['preposition.between_to', 'between 2000 and 2020', '2000 to 2020'],
    ['preposition.accounted_for', 'housing accounted for 34%', 'accounted to'],
    ['preposition.reached_to', 'it reached 450 in 2005', 'reached to 4'],
    ['preposition.stood_at', 'it stood at 12%', 'stood on'],
    ['article.superlative', 'making it the lowest figure', 'lowest figure'],
    ['article.missing_a_change', 'there was a sharp rise', 'sharp rise'],
    ['word_form.adverb_for_adjective', 'a sharp rise', 'sharply rise'],
    ['word_form.adjective_for_adverb', 'sales fell sharply', 'fell sharp'],
    ['spelling.report', 'the proportion of', 'propotion'],
  ];
  for (const [id, text, expected] of cases) {
    const found = candidates(text, reportInsertionRules).filter(c => c.rule.id === id);
    assert.ok(found.some(c => c.replacement.includes(expected)), `${id}: ${found.map(c => c.replacement).join(', ') || 'no match'}`);
  }
  assert.deepEqual(candidates('the number of people who was', reportInsertionRules).filter(c => c.rule.id === 'agreement.number_of'), []);
  for (const i of items.filter(x => x.set === 'S')) {
    for (const e of i.expected.errors!) {
      assert.equal(e.original!.match(/\d+/g)?.join(), e.inserted!.match(/\d+/g)?.join(), `${i.id}: ${e.rule} changed a figure`);
    }
  }
  assert.equal(new Set([...insertionRules, ...reportInsertionRules].map(r => r.id)).size, insertionRules.length + reportInsertionRules.length);
});
