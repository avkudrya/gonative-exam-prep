import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {countWords, letterFacts} from '../../../packages/exam-domain/src/index.js';
import {usable} from '../build.js';
import {buildGT1Items, GT1_G_CASES, GT1_SPLIT, readGT1Inputs} from '../build-gt1.js';
import {candidates, insertErrors, insertionRules, letterInsertionRules} from '../insertions.js';

const {tasks, bases, essays} = readGT1Inputs();
const items = buildGT1Items(tasks, bases, essays);

test('the committed exam-gt1-v1 is a fresh build', () => {
  const onDisk = readFileSync(new URL('../../datasets/exam-gt1-v1/items.jsonl', import.meta.url), 'utf8');
  assert.equal(onDisk, items.map(i => JSON.stringify(i)).join('\n') + '\n', 'run npm run bench:gt1');
});

test('GT bases are adjudicated: every one with remarks has a decision, every fix keeps the original', () => {
  for (const b of bases) {
    if (!b.check?.clean) assert.ok(b.adjudication, `${b.id} has remarks but no adjudication`);
    if (b.adjudication?.status === 'fixed') assert.ok((b as {originalText?: string}).originalText, `${b.id} fixed without originalText`);
  }
  assert.equal(bases.filter(usable).length, 30);
  const authors = bases.reduce<Record<string, number>>((m, b) => ({...m, [b.author.provider]: (m[b.author.provider] ?? 0) + 1}), {});
  assert.deepEqual(authors, {anthropic: 15, openai: 15});
});

test('GT splits are by task and balanced by tone; every G case is in both splits', () => {
  const tone = new Map(tasks.map(t => [t.ref, t.stimulus.tone]));
  const tasksOf = (split: string) => new Set(items.filter(i => i.split === split && i.set !== 'G').map(i => i.taskRef));
  const dev = tasksOf('dev');
  for (const ref of tasksOf('test')) assert.ok(!dev.has(ref), `${ref} in both splits`);
  for (const split of ['dev', 'test'] as const) {
    const refs = tasks.filter(t => GT1_SPLIT[t.ref.split(':')[1]] === split).map(t => tone.get(t.ref));
    assert.deepEqual([refs.filter(t => t === 'formal').length, refs.filter(t => t === 'semi_formal').length, refs.filter(t => t === 'informal').length], [4, 4, 4]);
    for (const set of ['S', 'N'] as const) assert.equal(items.filter(i => i.set === set && i.split === split).length, 15);
    assert.deepEqual(items.filter(i => i.set === 'G' && i.split === split).map(i => i.source.case).sort(), [...GT1_G_CASES].sort());
  }
  for (const i of items) assert.equal(i.split, GT1_SPLIT[i.taskRef.split(':')[1]], `${i.id}: split follows its task`);
});

test('S and N letters open and close as their tone asks; G cases are what they say', () => {
  for (const i of items.filter(x => x.set !== 'G')) assert.deepEqual(letterFacts(i.text, i.stimulus.tone).mismatches, [], i.id);
  const g = (id: string) => items.find(i => i.id === id)!;
  for (const split of ['dev', 'test']) {
    const missing = g(`g-gt1-missing-point-${split}`);
    assert.ok(countWords(missing.text) >= 150, 'missing_point is not also under length');
    assert.equal(missing.expected.bands?.task_achievement?.max, 4);
    assert.deepEqual(g(`g-gt1-wrong-tone-${split}`).expected.letter?.mismatches, ['opening_tone', 'closing_tone']);
    assert.ok(g(`g-gt1-wrong-pair-${split}`).expected.letter?.mismatches.includes('closing_tone'));
    const under = countWords(g(`g-gt1-under-length-${split}`).text);
    assert.ok(under >= 100 && under < 150, `under_length ${under}`);
    assert.equal(g(`g-gt1-other-task-${split}`).expected.bands?.task_achievement?.max, 1);
  }
  assert.deepEqual(g('g-gt1-wrong-pair-test').expected.letter?.mismatches, ['closing_tone', 'opening_closing_pair']);
});

test('letter insertion rules make the intended errors and never touch the opening or closing line', () => {
  const sample = 'Dear Mr. Harris,\n\nI have been a member for six years. Thank you for looking at this on Monday. I look forward to hearing from you.\n\nYours sincerely,\nDaniel';
  const made = new Map(candidates(sample, letterInsertionRules).map(c => [c.rule.id, c.replacement]));
  assert.equal(made.get('tense.present_for_duration'), 'I am a member');
  assert.equal(made.get('verb_form.gerund_after_for'), 'Thank you for look');
  assert.equal(made.get('preposition.on_weekday'), 'in Monday');
  assert.equal(made.get('verb_form.look_forward_to'), 'look forward to hear');
  for (const b of bases.filter(usable)) {
    const tone = tasks.find(t => t.ref === `gonative-t1g:${b.taskId}`)!.stimulus.tone;
    const {text} = insertErrors(b.text, `probe-${b.id}`, {min: 4, max: 6, minFamilies: 3, rules: [...insertionRules, ...letterInsertionRules]});
    const before = letterFacts(b.text, tone);
    const after = letterFacts(text, tone);
    assert.deepEqual([after.opening?.line, after.closing?.line], [before.opening?.line, before.closing?.line], b.id);
  }
});
